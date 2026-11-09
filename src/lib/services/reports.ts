import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { addDays, daysOverdue, startOfMonth, startOfToday, toAccraDay } from "@/lib/dates";
import { toDecimalString } from "@/lib/money";
import { formatGhanaPhone } from "@/lib/phone";
import { toCsv } from "@/lib/csv";
import { assertCan, type Ctx } from "./context";
import { loadEntitlements } from "./entitlements";
import { listCustomersWithBalances } from "./ledger";

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export async function getDashboard(ctx: Ctx) {
  assertCan(ctx, "customers.view");
  const b = ctx.businessId;
  const today = startOfToday();
  const month = startOfMonth();
  const [aging, salesMonth, collectedMonth, collectedToday, lowStock, recentPayments, topOverdue, customerCount] = await Promise.all([
    db.$queryRaw<{ current: bigint; d1_30: bigint; d31_60: bigint; d61_90: bigint; d90: bigint; open_count: bigint }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN "dueDate" >= ${today} THEN total - "amountPaid" END),0)::bigint AS current,
        COALESCE(SUM(CASE WHEN "dueDate" < ${today} AND "dueDate" >= ${addDays(today, -30)} THEN total - "amountPaid" END),0)::bigint AS d1_30,
        COALESCE(SUM(CASE WHEN "dueDate" < ${addDays(today, -30)} AND "dueDate" >= ${addDays(today, -60)} THEN total - "amountPaid" END),0)::bigint AS d31_60,
        COALESCE(SUM(CASE WHEN "dueDate" < ${addDays(today, -60)} AND "dueDate" >= ${addDays(today, -90)} THEN total - "amountPaid" END),0)::bigint AS d61_90,
        COALESCE(SUM(CASE WHEN "dueDate" < ${addDays(today, -90)} THEN total - "amountPaid" END),0)::bigint AS d90,
        COUNT(*)::bigint AS open_count
      FROM "Invoice" WHERE "businessId" = ${b} AND status = 'ISSUED' AND total > "amountPaid"`,
    db.invoice.aggregate({ where: { businessId: b, status: "ISSUED", issueDate: { gte: month } }, _sum: { total: true }, _count: true }),
    db.payment.aggregate({ where: { businessId: b, status: "RECORDED", receivedAt: { gte: month } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { businessId: b, status: "RECORDED", receivedAt: { gte: today } }, _sum: { amount: true } }),
    db.product.findMany({ where: { businessId: b, isActive: true, trackStock: true, stockQty: { lte: db.product.fields.reorderLevel } }, orderBy: { stockQty: "asc" }, take: 8 }),
    db.payment.findMany({ where: { businessId: b, status: "RECORDED" }, include: { customer: { select: { name: true } } }, orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }], take: 6 }),
    listCustomersWithBalances(b, { filter: "overdue", sort: "overdue", pageSize: 6 }),
    db.customer.count({ where: { businessId: b, isActive: true } }),
  ]);
  const a = aging[0];
  const buckets = { current: n(a.current), d1_30: n(a.d1_30), d31_60: n(a.d31_60), d61_90: n(a.d61_90), d90: n(a.d90) };
  const outstanding = Object.values(buckets).reduce((s, v) => s + v, 0);
  return {
    outstanding,
    overdue: outstanding - buckets.current,
    buckets,
    openInvoices: n(a.open_count),
    salesThisMonth: salesMonth._sum.total ?? 0,
    invoicesThisMonth: salesMonth._count,
    collectedThisMonth: collectedMonth._sum.amount ?? 0,
    collectedToday: collectedToday._sum.amount ?? 0,
    lowStock,
    recentPayments,
    topOverdue: topOverdue.rows,
    customerCount,
  };
}

/** Customer statement: opening balance + chronological invoices/payments with running balance. */
export async function getStatement(ctx: Ctx, customerId: string, from: Date, to: Date) {
  assertCan(ctx, "customers.view");
  const customer = await db.customer.findFirst({ where: { id: customerId, businessId: ctx.businessId } });
  if (!customer) throw new AppError("NOT_FOUND", "Customer not found.");
  const toEnd = addDays(to, 1);
  const [invBefore, payBefore, invoices, payments, openInvoices] = await Promise.all([
    db.invoice.aggregate({ where: { businessId: ctx.businessId, customerId, status: "ISSUED", issueDate: { lt: from } }, _sum: { total: true } }),
    db.payment.aggregate({ where: { businessId: ctx.businessId, customerId, status: "RECORDED", receivedAt: { lt: from } }, _sum: { amount: true } }),
    db.invoice.findMany({ where: { businessId: ctx.businessId, customerId, status: "ISSUED", issueDate: { gte: from, lt: toEnd } }, orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }] }),
    db.payment.findMany({ where: { businessId: ctx.businessId, customerId, status: "RECORDED", receivedAt: { gte: from, lt: toEnd } }, orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }] }),
    db.invoice.findMany({ where: { businessId: ctx.businessId, customerId, status: "ISSUED", amountPaid: { lt: db.invoice.fields.total } }, orderBy: { dueDate: "asc" } }),
  ]);
  const opening = (invBefore._sum.total ?? 0) - (payBefore._sum.amount ?? 0);
  type Line = { date: Date; createdAt: Date; kind: "invoice" | "payment"; ref: string; id: string; debit: number; credit: number; balance: number; detail: string };
  const lines: Line[] = [
    ...invoices.map((i) => ({ date: i.issueDate, createdAt: i.createdAt, kind: "invoice" as const, ref: i.number, id: i.id, debit: i.total, credit: 0, balance: 0, detail: `Due ${toAccraDay(i.dueDate)}` })),
    ...payments.map((p) => ({ date: p.receivedAt, createdAt: p.createdAt, kind: "payment" as const, ref: p.receiptNumber, id: p.id, debit: 0, credit: p.amount, balance: 0, detail: `${p.method}${p.reference ? ` · ${p.reference}` : ""}` })),
  ].sort((x, y) => x.date.getTime() - y.date.getTime() || x.createdAt.getTime() - y.createdAt.getTime());
  let running = opening;
  for (const l of lines) {
    running += l.debit - l.credit;
    l.balance = running;
  }
  return {
    customer,
    opening,
    closing: running,
    lines,
    openInvoices: openInvoices.map((i) => ({ ...i, outstanding: i.total - i.amountPaid, daysOverdue: daysOverdue(i.dueDate) })),
  };
}

export async function getPeriodSummary(ctx: Ctx, from: Date, to: Date) {
  assertCan(ctx, "reports.view");
  const toEnd = addDays(to, 1);
  const b = ctx.businessId;
  const [sales, byMethod, byStaff, salesByStaff] = await Promise.all([
    db.invoice.aggregate({ where: { businessId: b, status: "ISSUED", issueDate: { gte: from, lt: toEnd } }, _sum: { total: true, discount: true }, _count: true }),
    db.payment.groupBy({ by: ["method"], where: { businessId: b, status: "RECORDED", receivedAt: { gte: from, lt: toEnd } }, _sum: { amount: true }, _count: true }),
    db.payment.groupBy({ by: ["recordedById"], where: { businessId: b, status: "RECORDED", receivedAt: { gte: from, lt: toEnd } }, _sum: { amount: true }, _count: true }),
    db.invoice.groupBy({ by: ["createdById"], where: { businessId: b, status: "ISSUED", issueDate: { gte: from, lt: toEnd } }, _sum: { total: true }, _count: true }),
  ]);
  const userIds = [...new Set([...byStaff.map((s) => s.recordedById), ...salesByStaff.map((s) => s.createdById)])];
  const users = await db.user.findMany({ where: { id: { in: userIds }, memberships: { some: { businessId: b } } }, select: { id: true, name: true } });
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Former staff";
  const staff = userIds.map((id) => ({
    name: nameOf(id),
    sales: salesByStaff.find((s) => s.createdById === id)?._sum.total ?? 0,
    invoices: salesByStaff.find((s) => s.createdById === id)?._count ?? 0,
    collected: byStaff.find((s) => s.recordedById === id)?._sum.amount ?? 0,
    payments: byStaff.find((s) => s.recordedById === id)?._count ?? 0,
  }));
  return {
    salesTotal: sales._sum.total ?? 0,
    discounts: sales._sum.discount ?? 0,
    invoiceCount: sales._count,
    collections: byMethod.map((m) => ({ method: m.method, amount: m._sum.amount ?? 0, count: m._count })),
    collectedTotal: byMethod.reduce((s, m) => s + (m._sum.amount ?? 0), 0),
    staff: staff.sort((x, y) => y.collected + y.sales - (x.collected + x.sales)),
  };
}

export type ExportKind = "customers" | "invoices" | "payments" | "aging";

export async function exportCsv(ctx: Ctx, kind: ExportKind, from?: Date, to?: Date): Promise<{ filename: string; csv: string }> {
  assertCan(ctx, "data.export");
  const ent = await loadEntitlements(ctx.businessId);
  // Owners can always export their own data (even after expiry) so they are never locked in.
  if (!ent.canExport && !(ctx.role === "OWNER" && !ent.canWrite)) {
    throw new AppError("PLAN_LIMIT", "CSV export is available on the Growth and Distributor plans. Upgrade on the Billing page.");
  }
  const b = ctx.businessId;
  const toEnd = to ? addDays(to, 1) : undefined;
  const stamp = toAccraDay(new Date());
  let csv: string;
  let count = 0;
  if (kind === "customers" || kind === "aging") {
    const all = await listCustomersWithBalances(b, { pageSize: 200, page: 1, sort: kind === "aging" ? "overdue" : "name", filter: kind === "aging" ? "owing" : "all" });
    let rows = all.rows;
    for (let p = 2; p <= all.pageCount; p++) rows = rows.concat((await listCustomersWithBalances(b, { pageSize: 200, page: p, sort: kind === "aging" ? "overdue" : "name", filter: kind === "aging" ? "owing" : "all" })).rows);
    count = rows.length;
    csv = toCsv(
      ["Customer", "Contact", "Phone", "Location", "Credit limit (GHS)", "Balance (GHS)", "Overdue (GHS)", "Oldest unpaid due date", "Assigned to"],
      rows.map((r) => [r.name, r.contactName, formatGhanaPhone(r.phone), r.location, toDecimalString(r.creditLimit), toDecimalString(r.balance), toDecimalString(r.overdue), r.oldestDue ? toAccraDay(r.oldestDue) : "", r.assignedName]),
    );
  } else if (kind === "invoices") {
    const rows = await db.invoice.findMany({
      where: { businessId: b, ...(from || toEnd ? { issueDate: { gte: from, lt: toEnd } } : {}) },
      include: { customer: { select: { name: true } } },
      orderBy: { issueDate: "asc" },
      take: 50_000,
    });
    count = rows.length;
    csv = toCsv(
      ["Invoice", "Date", "Due date", "Customer", "Subtotal (GHS)", "Discount (GHS)", "Total (GHS)", "Paid (GHS)", "Outstanding (GHS)", "Status"],
      rows.map((r) => [r.number, toAccraDay(r.issueDate), toAccraDay(r.dueDate), r.customer.name, toDecimalString(r.subtotal), toDecimalString(r.discount), toDecimalString(r.total), toDecimalString(r.amountPaid), toDecimalString(r.status === "VOID" ? 0 : r.total - r.amountPaid), r.status]),
    );
  } else {
    const rows = await db.payment.findMany({
      where: { businessId: b, ...(from || toEnd ? { receivedAt: { gte: from, lt: toEnd } } : {}) },
      include: { customer: { select: { name: true } } },
      orderBy: { receivedAt: "asc" },
      take: 50_000,
    });
    count = rows.length;
    csv = toCsv(
      ["Receipt", "Date", "Customer", "Amount (GHS)", "Method", "Reference", "Status"],
      rows.map((r) => [r.receiptNumber, toAccraDay(r.receivedAt), r.customer.name, toDecimalString(r.amount), r.method, r.reference, r.status]),
    );
  }
  await audit({ businessId: b, userId: ctx.userId, action: "data.export", metadata: { kind, rows: count, from: from ? toAccraDay(from) : null, to: to ? toAccraDay(to) : null }, ip: ctx.ip });
  return { filename: `businestra-${kind}-${stamp}.csv`, csv };
}
