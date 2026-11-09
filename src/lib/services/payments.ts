import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { addDays, startOfToday } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { day, id, money, optionalText } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, type Ctx } from "./context";
import { assertWritable } from "./entitlements";
import { lockCustomer, reallocateCustomer } from "./ledger";
import { formatDocNumber } from "./invoices";

export const paymentSchema = z.object({
  customerId: id,
  amount: money("Amount"),
  method: z.enum(["CASH", "MOMO", "BANK", "CHEQUE"], { error: "Choose a payment method" }),
  reference: optionalText(100),
  receivedAt: day("Date received"),
  notes: optionalText(500),
});

export async function recordPayment(ctx: Ctx, input: Record<string, unknown>) {
  assertCan(ctx, "payments.record");
  const data = paymentSchema.parse(input);
  if (data.amount <= 0) throw new AppError("VALIDATION", "Amount must be more than zero.", { amount: "Must be more than zero" });
  if (data.receivedAt > addDays(startOfToday(), 1)) throw new AppError("VALIDATION", "Payment date cannot be in the future.", { receivedAt: "Cannot be in the future" });
  if ((data.method === "MOMO" || data.method === "BANK") && !data.reference) {
    throw new AppError("VALIDATION", "Enter the MoMo transaction ID or bank reference so this payment can be traced.", { reference: "Required for MoMo and bank payments" });
  }
  await assertWritable(ctx.businessId);

  return db.$transaction(async (tx) => {
    await lockCustomer(tx, ctx.businessId, data.customerId);
    if (data.reference) {
      // Guard against the same MoMo/bank payment being recorded twice (honest mistake or fraud).
      const dup = await tx.payment.findFirst({ where: { businessId: ctx.businessId, status: "RECORDED", method: data.method, reference: { equals: data.reference, mode: "insensitive" } } });
      if (dup) throw new AppError("CONFLICT", `A ${data.method} payment with reference "${data.reference}" was already recorded (receipt ${dup.receiptNumber}).`, { reference: "Already recorded" });
    }
    const biz = await tx.business.update({ where: { id: ctx.businessId }, data: { nextReceiptNumber: { increment: 1 } } });
    const payment = await tx.payment.create({
      data: {
        businessId: ctx.businessId,
        customerId: data.customerId,
        receiptNumber: formatDocNumber(biz.receiptPrefix, biz.nextReceiptNumber - 1),
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        receivedAt: data.receivedAt,
        notes: data.notes,
        recordedById: ctx.userId,
      },
    });
    const { unallocated } = await reallocateCustomer(tx, ctx.businessId, data.customerId);
    await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "payment.record", entityType: "Payment", entityId: payment.id, metadata: { receipt: payment.receiptNumber, amount: data.amount, method: data.method }, ip: ctx.ip }, tx);
    return { payment, unallocated };
  });
}

export async function voidPayment(ctx: Ctx, paymentId: string, rawReason: unknown) {
  assertCan(ctx, "payments.void");
  const reason = z.string().trim().min(3, "Give a reason (at least 3 characters)").max(300).parse(rawReason);
  await assertWritable(ctx.businessId);
  const p = await db.payment.findFirst({ where: { id: paymentId, businessId: ctx.businessId } });
  if (!p) throw new AppError("NOT_FOUND", "Payment not found.");
  await db.$transaction(async (tx) => {
    await lockCustomer(tx, ctx.businessId, p.customerId);
    const claimed = await tx.payment.updateMany({ where: { id: p.id, status: "RECORDED" }, data: { status: "VOID", voidedAt: new Date(), voidedById: ctx.userId, voidReason: reason } });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "This payment is already void.");
    await reallocateCustomer(tx, ctx.businessId, p.customerId);
    await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "payment.void", entityType: "Payment", entityId: p.id, metadata: { receipt: p.receiptNumber, amount: p.amount, amountText: formatCedis(p.amount), reason }, ip: ctx.ip }, tx);
  });
}

export async function getPayment(ctx: Ctx, paymentId: string) {
  assertCan(ctx, "customers.view");
  const p = await db.payment.findFirst({
    where: { id: paymentId, businessId: ctx.businessId },
    include: { customer: true, allocations: { include: { invoice: { select: { id: true, number: true, total: true } } } } },
  });
  if (!p) throw new AppError("NOT_FOUND", "Payment not found.");
  return p;
}

export async function listPayments(ctx: Ctx, opts: { q?: string; method?: string; customerId?: string; page?: number; pageSize?: number }) {
  assertCan(ctx, "customers.view");
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const page = Math.max(opts.page ?? 1, 1);
  const where: Prisma.PaymentWhereInput = { businessId: ctx.businessId };
  if (opts.customerId) where.customerId = opts.customerId;
  if (opts.method && ["CASH", "MOMO", "BANK", "CHEQUE"].includes(opts.method)) where.method = opts.method as Prisma.PaymentWhereInput["method"];
  const q = opts.q?.trim().slice(0, 100);
  if (q) {
    where.OR = [
      { receiptNumber: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  const [rows, total] = await Promise.all([
    db.payment.findMany({ where, include: { customer: { select: { id: true, name: true } } }, orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.payment.count({ where }),
  ]);
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
