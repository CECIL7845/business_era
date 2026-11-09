import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/auth/permissions";
import { addDays, startOfToday } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { checkbox, day, id, int, money, optionalDay, optionalMoney, optionalText } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, type Ctx } from "./context";
import { assertWritable } from "./entitlements";
import { getCustomerBalance, lockCustomer, reallocateCustomer } from "./ledger";

const itemSchema = z.object({
  productId: z.preprocess((v) => (v === "" || v == null ? undefined : v), id.optional()),
  description: optionalText(200),
  quantity: int("Quantity", 1, 1_000_000),
  unitPrice: money("Unit price"),
});

export const invoiceSchema = z.object({
  customerId: id,
  issueDate: day("Invoice date"),
  dueDate: optionalDay("Due date"),
  discount: optionalMoney("Discount"),
  notes: optionalText(500),
  items: z.preprocess((v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }, z.array(itemSchema, { error: "Add at least one item" }).min(1, "Add at least one item").max(100, "Maximum 100 lines per invoice")),
  overrideCreditLimit: checkbox.optional(),
  paidNowAmount: optionalMoney("Amount paid now"),
  paidNowMethod: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(["CASH", "MOMO", "BANK", "CHEQUE"]).optional()),
  paidNowReference: optionalText(100),
});

export const formatDocNumber = (prefix: string, n: number) => `${prefix}-${String(n).padStart(5, "0")}`;

export async function createInvoice(ctx: Ctx, input: Record<string, unknown>) {
  assertCan(ctx, "invoices.create");
  const data = invoiceSchema.parse(input);
  await assertWritable(ctx.businessId);
  if (data.issueDate > addDays(startOfToday(), 1)) throw new AppError("VALIDATION", "Invoice date cannot be in the future.", { issueDate: "Cannot be in the future" });
  if (data.dueDate && data.dueDate < data.issueDate) throw new AppError("VALIDATION", "Due date cannot be before the invoice date.", { dueDate: "Before invoice date" });
  if (data.paidNowAmount && !data.paidNowMethod) throw new AppError("VALIDATION", "Choose how the customer paid.", { paidNowMethod: "Required" });

  return db.$transaction(
    async (tx) => {
      await lockCustomer(tx, ctx.businessId, data.customerId);
      const customer = await tx.customer.findFirstOrThrow({ where: { id: data.customerId, businessId: ctx.businessId } });
      if (!customer.isActive) throw new AppError("VALIDATION", "This customer is deactivated. Reactivate them first.");

      // Products must belong to this business (tenant isolation on every referenced id).
      const productIds = [...new Set(data.items.map((i) => i.productId).filter(Boolean) as string[])];
      const products = await tx.product.findMany({ where: { id: { in: productIds }, businessId: ctx.businessId } });
      const byId = new Map(products.map((p) => [p.id, p]));
      if (byId.size !== productIds.length) throw new AppError("VALIDATION", "One or more products were not found. Refresh and try again.");

      const canSetPrice = can(ctx.role, "invoices.overrideCreditLimit"); // owners/managers may negotiate prices
      const lines = data.items.map((item, idx) => {
        const p = item.productId ? byId.get(item.productId)! : null;
        if (!p && !canSetPrice) throw new AppError("VALIDATION", `Line ${idx + 1}: choose a product from the list.`);
        if (p && !p.isActive) throw new AppError("VALIDATION", `${p.name} is no longer active.`);
        const description = (item.description || p?.name || "").trim();
        if (!description) throw new AppError("VALIDATION", `Line ${idx + 1}: add a description.`);
        const unitPrice = p && !canSetPrice ? p.unitPrice : item.unitPrice;
        return { productId: p?.id ?? null, description, quantity: item.quantity, unitPrice, lineTotal: item.quantity * unitPrice };
      });
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      const discount = data.discount ?? 0;
      if (discount > subtotal) throw new AppError("VALIDATION", "Discount cannot be more than the subtotal.", { discount: "Too large" });
      const total = subtotal - discount;
      const paidNow = data.paidNowAmount ?? 0;
      if (paidNow > total) throw new AppError("VALIDATION", "Amount paid now cannot exceed the invoice total. Record extra as a separate payment.", { paidNowAmount: "More than total" });

      // Credit control: block if the new balance would exceed the approved limit.
      const { balance } = await getCustomerBalance(ctx.businessId, customer.id, tx);
      const newBalance = balance + total - paidNow;
      let overridden = false;
      if (newBalance > 0 && newBalance > customer.creditLimit) {
        if (data.overrideCreditLimit && can(ctx.role, "invoices.overrideCreditLimit")) overridden = true;
        else {
          throw new AppError(
            "CREDIT_LIMIT",
            `This sale would take ${customer.name} to ${formatCedis(newBalance)}, above their credit limit of ${formatCedis(customer.creditLimit)}. ` +
              (can(ctx.role, "invoices.overrideCreditLimit") ? "Tick 'override credit limit' to proceed, collect a payment first, or raise the limit." : "Collect a payment first or ask a manager to approve."),
          );
        }
      }

      // Stock: decrement atomically, refusing to go negative.
      for (const l of lines) {
        const p = l.productId ? byId.get(l.productId) : null;
        if (!p?.trackStock) continue;
        const res = await tx.product.updateMany({ where: { id: p.id, businessId: ctx.businessId, stockQty: { gte: l.quantity } }, data: { stockQty: { decrement: l.quantity } } });
        if (res.count !== 1) {
          const fresh = await tx.product.findUniqueOrThrow({ where: { id: p.id } });
          throw new AppError("INSUFFICIENT_STOCK", `Not enough stock for ${p.name}: ${fresh.stockQty} ${p.unit} available, ${l.quantity} requested. Record a restock first.`);
        }
      }

      const biz = await tx.business.update({ where: { id: ctx.businessId }, data: { nextInvoiceNumber: { increment: 1 } } });
      const number = formatDocNumber(biz.invoicePrefix, biz.nextInvoiceNumber - 1);
      const invoice = await tx.invoice.create({
        data: {
          businessId: ctx.businessId,
          number,
          customerId: customer.id,
          issueDate: data.issueDate,
          dueDate: data.dueDate ?? addDays(data.issueDate, customer.paymentTermsDays),
          subtotal,
          discount,
          total,
          notes: data.notes,
          createdById: ctx.userId,
          items: { create: lines },
        },
      });
      const movements: Prisma.StockMovementCreateManyInput[] = lines
        .filter((l) => l.productId && byId.get(l.productId)?.trackStock)
        .map((l) => ({ businessId: ctx.businessId, productId: l.productId!, change: -l.quantity, reason: "SALE", invoiceId: invoice.id, createdById: ctx.userId }));
      if (movements.length) await tx.stockMovement.createMany({ data: movements });

      if (paidNow > 0) {
        const b2 = await tx.business.update({ where: { id: ctx.businessId }, data: { nextReceiptNumber: { increment: 1 } } });
        await tx.payment.create({
          data: {
            businessId: ctx.businessId,
            customerId: customer.id,
            receiptNumber: formatDocNumber(b2.receiptPrefix, b2.nextReceiptNumber - 1),
            amount: paidNow,
            method: data.paidNowMethod!,
            reference: data.paidNowReference,
            receivedAt: data.issueDate,
            notes: `Paid with ${number}`,
            recordedById: ctx.userId,
          },
        });
      }
      await reallocateCustomer(tx, ctx.businessId, customer.id);
      await audit(
        { businessId: ctx.businessId, userId: ctx.userId, action: overridden ? "invoice.create_credit_override" : "invoice.create", entityType: "Invoice", entityId: invoice.id, metadata: { number, total, newBalance, creditLimit: customer.creditLimit }, ip: ctx.ip },
        tx,
      );
      return invoice;
    },
    { timeout: 20_000 },
  );
}

export async function voidInvoice(ctx: Ctx, invoiceId: string, rawReason: unknown) {
  assertCan(ctx, "invoices.void");
  const reason = z.string().trim().min(3, "Give a reason (at least 3 characters)").max(300).parse(rawReason);
  await assertWritable(ctx.businessId);
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, businessId: ctx.businessId }, include: { items: true } });
  if (!inv) throw new AppError("NOT_FOUND", "Invoice not found.");
  if (inv.status === "VOID") throw new AppError("CONFLICT", "This invoice is already void.");
  await db.$transaction(async (tx) => {
    await lockCustomer(tx, ctx.businessId, inv.customerId);
    const claimed = await tx.invoice.updateMany({ where: { id: inv.id, status: "ISSUED" }, data: { status: "VOID", voidedAt: new Date(), voidedById: ctx.userId, voidReason: reason } });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "This invoice is already void.");
    // Return goods to stock.
    const sold = await tx.stockMovement.findMany({ where: { businessId: ctx.businessId, invoiceId: inv.id, reason: "SALE" } });
    for (const m of sold) {
      await tx.product.updateMany({ where: { id: m.productId, businessId: ctx.businessId }, data: { stockQty: { increment: -m.change } } });
    }
    if (sold.length) {
      await tx.stockMovement.createMany({
        data: sold.map((m) => ({ businessId: ctx.businessId, productId: m.productId, change: -m.change, reason: "SALE_VOID" as const, invoiceId: inv.id, createdById: ctx.userId, note: `Void ${inv.number}` })),
      });
    }
    await reallocateCustomer(tx, ctx.businessId, inv.customerId);
    await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "invoice.void", entityType: "Invoice", entityId: inv.id, metadata: { number: inv.number, total: inv.total, reason }, ip: ctx.ip }, tx);
  });
}

export async function getInvoice(ctx: Ctx, invoiceId: string) {
  assertCan(ctx, "customers.view");
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, businessId: ctx.businessId },
    include: {
      items: true,
      customer: true,
      allocations: { include: { payment: { select: { id: true, receiptNumber: true, receivedAt: true, method: true, status: true } } } },
    },
  });
  if (!inv) throw new AppError("NOT_FOUND", "Invoice not found.");
  return inv;
}

export type InvoiceStatusFilter = "all" | "open" | "overdue" | "paid" | "void";

export async function listInvoices(ctx: Ctx, opts: { q?: string; status?: InvoiceStatusFilter; customerId?: string; page?: number; pageSize?: number }) {
  assertCan(ctx, "customers.view");
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const page = Math.max(opts.page ?? 1, 1);
  const where: Prisma.InvoiceWhereInput = { businessId: ctx.businessId };
  if (opts.customerId) where.customerId = opts.customerId;
  const q = opts.q?.trim().slice(0, 100);
  if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }];
  switch (opts.status) {
    case "open":
      Object.assign(where, { status: "ISSUED", amountPaid: { lt: db.invoice.fields.total } });
      break;
    case "overdue":
      Object.assign(where, { status: "ISSUED", amountPaid: { lt: db.invoice.fields.total }, dueDate: { lt: startOfToday() } });
      break;
    case "paid":
      Object.assign(where, { status: "ISSUED", amountPaid: { equals: db.invoice.fields.total } });
      break;
    case "void":
      where.status = "VOID";
      break;
  }
  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { customer: { select: { id: true, name: true } } },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count({ where }),
  ]);
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
