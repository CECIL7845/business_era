import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import { startOfToday } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { allocateFifo } from "./allocation";

/** Row lock on the customer so concurrent invoices/payments for one customer serialize. */
export async function lockCustomer(tx: Tx, businessId: string, customerId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Customer" WHERE id = ${customerId} AND "businessId" = ${businessId} FOR UPDATE`;
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Customer not found.");
}

/**
 * Recompute all payment allocations for one customer from scratch (FIFO by due date).
 * Deterministic and self-healing: run after any invoice/payment create or void.
 * Caller must hold the customer lock inside the same transaction.
 */
export async function reallocateCustomer(tx: Tx, businessId: string, customerId: string) {
  const invoices = await tx.invoice.findMany({
    where: { businessId, customerId },
    orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, total: true, amountPaid: true, status: true },
  });
  const payments = await tx.payment.findMany({
    where: { businessId, customerId, status: "RECORDED" },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, amount: true },
  });
  const issued = invoices.filter((inv) => inv.status === "ISSUED");
  const { allocations, paid, unallocated } = allocateFifo(issued, payments);

  await tx.paymentAllocation.deleteMany({ where: { payment: { businessId, customerId } } });
  if (allocations.length) await tx.paymentAllocation.createMany({ data: allocations });
  for (const inv of invoices) {
    const next = inv.status === "ISSUED" ? (paid.get(inv.id) ?? 0) : 0;
    if (next !== inv.amountPaid) await tx.invoice.update({ where: { id: inv.id }, data: { amountPaid: next } });
  }
  return { unallocated };
}

export type CustomerBalance = { invoiced: number; paid: number; balance: number; overdue: number; credit: number };

/** Balance = issued invoices − recorded payments. Negative balance means the customer has credit. */
export async function getCustomerBalance(businessId: string, customerId: string, client: Tx | typeof db = db): Promise<CustomerBalance> {
  const today = startOfToday();
  const [inv, pay, overdue] = await Promise.all([
    client.invoice.aggregate({ where: { businessId, customerId, status: "ISSUED" }, _sum: { total: true } }),
    client.payment.aggregate({ where: { businessId, customerId, status: "RECORDED" }, _sum: { amount: true } }),
    client.$queryRaw<{ overdue: bigint | null }[]>`
      SELECT SUM("total" - "amountPaid") AS overdue FROM "Invoice"
      WHERE "businessId" = ${businessId} AND "customerId" = ${customerId} AND status = 'ISSUED' AND "dueDate" < ${today}`,
  ]);
  const invoiced = inv._sum.total ?? 0;
  const paid = pay._sum.amount ?? 0;
  const balance = invoiced - paid;
  return { invoiced, paid, balance, overdue: Number(overdue[0]?.overdue ?? 0), credit: balance < 0 ? -balance : 0 };
}

export type CustomerFilter = "all" | "owing" | "overdue" | "over_limit" | "inactive";
export type CustomerSort = "name" | "balance" | "overdue";

export type CustomerRow = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  location: string | null;
  creditLimit: number;
  isActive: boolean;
  balance: number;
  overdue: number;
  oldestDue: Date | null;
  assignedName: string | null;
};

/** Customer list with live balances, computed in one parameterised SQL query. */
export async function listCustomersWithBalances(
  businessId: string,
  opts: { q?: string; filter?: CustomerFilter; sort?: CustomerSort; page?: number; pageSize?: number; assignedToId?: string },
) {
  const today = startOfToday();
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 200);
  const page = Math.max(opts.page ?? 1, 1);
  const q = opts.q?.trim().slice(0, 100);

  const conditions: Prisma.Sql[] = [Prisma.sql`c."businessId" = ${businessId}`];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    conditions.push(
      digits.length >= 4
        ? Prisma.sql`(c.name ILIKE ${like} OR c."contactName" ILIKE ${like} OR c.location ILIKE ${like} OR c.phone LIKE ${`%${digits}%`})`
        : Prisma.sql`(c.name ILIKE ${like} OR c."contactName" ILIKE ${like} OR c.location ILIKE ${like})`,
    );
  }
  if (opts.assignedToId) conditions.push(Prisma.sql`c."assignedToId" = ${opts.assignedToId}`);
  const filter = opts.filter ?? "all";
  if (filter === "inactive") conditions.push(Prisma.sql`c."isActive" = false`);
  else conditions.push(Prisma.sql`c."isActive" = true`);
  if (filter === "owing") conditions.push(Prisma.sql`COALESCE(i.invoiced,0) - COALESCE(p.paid,0) > 0`);
  if (filter === "overdue") conditions.push(Prisma.sql`COALESCE(i.overdue,0) > 0`);
  if (filter === "over_limit") conditions.push(Prisma.sql`COALESCE(i.invoiced,0) - COALESCE(p.paid,0) > c."creditLimit"`);

  const orderBy =
    opts.sort === "balance" ? Prisma.sql`balance DESC, c.name ASC` : opts.sort === "overdue" ? Prisma.sql`overdue DESC, c.name ASC` : Prisma.sql`c.name ASC`;

  const base = Prisma.sql`
    FROM "Customer" c
    LEFT JOIN (
      SELECT "customerId", SUM(total) AS invoiced,
             SUM(CASE WHEN "dueDate" < ${today} THEN total - "amountPaid" ELSE 0 END) AS overdue,
             MIN(CASE WHEN total > "amountPaid" THEN "dueDate" END) AS "oldestDue"
      FROM "Invoice" WHERE "businessId" = ${businessId} AND status = 'ISSUED' GROUP BY "customerId"
    ) i ON i."customerId" = c.id
    LEFT JOIN (
      SELECT "customerId", SUM(amount) AS paid FROM "Payment"
      WHERE "businessId" = ${businessId} AND status = 'RECORDED' GROUP BY "customerId"
    ) p ON p."customerId" = c.id
    LEFT JOIN "Membership" m ON m.id = c."assignedToId"
    LEFT JOIN "User" u ON u.id = m."userId"
    WHERE ${Prisma.join(conditions, " AND ")}`;

  const [rows, countRows] = await Promise.all([
    db.$queryRaw<(Omit<CustomerRow, "balance" | "overdue"> & { balance: bigint; overdue: bigint })[]>`
      SELECT c.id, c.name, c."contactName", c.phone, c.location, c."creditLimit", c."isActive",
             (COALESCE(i.invoiced,0) - COALESCE(p.paid,0))::bigint AS balance,
             COALESCE(i.overdue,0)::bigint AS overdue, i."oldestDue", u.name AS "assignedName"
      ${base} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n ${base}`,
  ]);
  const total = Number(countRows[0]?.n ?? 0);
  return {
    rows: rows.map((r) => ({ ...r, balance: Number(r.balance), overdue: Number(r.overdue) })) as CustomerRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
