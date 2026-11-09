import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { appUrl } from "@/lib/email";
import { logger } from "@/lib/logger";
import { computeNewPeriodEnd, effectiveStatus } from "@/lib/billing/subscription";
import { initializeTransaction, verifyTransaction, type VerifiedTransaction } from "@/lib/billing/paystack";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertCan, type Ctx } from "./context";

const checkoutSchema = z.object({
  planCode: z.string().trim().min(1).max(20),
  interval: z.enum(["MONTHLY", "ANNUAL"]),
});

/** Plan change is blocked if current usage would exceed the new plan's limits. */
async function assertFitsPlan(businessId: string, plan: { name: string; maxUsers: number; maxCustomers: number }) {
  const [users, customers] = await Promise.all([db.membership.count({ where: { businessId } }), db.customer.count({ where: { businessId, isActive: true } })]);
  if (users > plan.maxUsers) throw new AppError("PLAN_LIMIT", `The ${plan.name} plan allows ${plan.maxUsers} users but you have ${users}. Remove staff first or choose a bigger plan.`);
  if (plan.maxCustomers >= 0 && customers > plan.maxCustomers) throw new AppError("PLAN_LIMIT", `The ${plan.name} plan allows ${plan.maxCustomers} active customers but you have ${customers}. Deactivate some or choose a bigger plan.`);
}

export async function startCheckout(ctx: Ctx, input: Record<string, unknown>, payerEmail: string) {
  assertCan(ctx, "billing.manage");
  const data = checkoutSchema.parse(input);
  await enforceRateLimit(`checkout:${ctx.businessId}`, 20, 3600);
  const plan = await db.plan.findUnique({ where: { code: data.planCode } });
  if (!plan || !plan.isActive) throw new AppError("VALIDATION", "That plan is not available.");
  await assertFitsPlan(ctx.businessId, plan);
  const amount = data.interval === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly;
  const reference = `bz_${randomToken(12)}`;
  // Record the expected amount BEFORE redirecting, so the webhook can be checked against it.
  await db.billingTransaction.create({
    data: { businessId: ctx.businessId, reference, planCode: plan.code, interval: data.interval, amount, initiatedById: ctx.userId },
  });
  const { authorizationUrl } = await initializeTransaction({
    email: payerEmail,
    amount,
    reference,
    callbackUrl: appUrl("/app/billing/callback"),
    metadata: { businessId: ctx.businessId, planCode: plan.code, interval: data.interval },
  });
  await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "billing.checkout_start", entityType: "BillingTransaction", entityId: reference, metadata: { plan: plan.code, interval: data.interval, amount }, ip: ctx.ip });
  return authorizationUrl;
}

export type ApplyResult = "applied" | "already_applied" | "failed" | "pending" | "mismatch" | "unknown_reference";

/**
 * Apply a provider-verified transaction. Safe to call any number of times, from the
 * webhook, the browser callback, or reconciliation — the subscription is extended
 * exactly once because only one caller can flip appliedAt from NULL.
 */
export async function applyVerifiedTransaction(v: VerifiedTransaction): Promise<ApplyResult> {
  const txn = await db.billingTransaction.findUnique({ where: { reference: v.reference } });
  if (!txn) {
    logger.warn("billing_unknown_reference", { reference: v.reference });
    return "unknown_reference";
  }
  if (txn.appliedAt) return "already_applied";

  if (v.status !== "success") {
    if (["failed", "abandoned", "reversed"].includes(v.status)) {
      await db.billingTransaction.updateMany({
        where: { id: txn.id, appliedAt: null, status: "PENDING" },
        data: { status: v.status === "abandoned" ? "ABANDONED" : "FAILED", failureReason: v.gatewayResponse?.slice(0, 200) ?? v.status },
      });
      return "failed";
    }
    return "pending";
  }

  if (v.amount !== txn.amount || v.currency !== txn.currency) {
    await db.billingTransaction.update({ where: { id: txn.id }, data: { status: "FAILED", failureReason: `Amount/currency mismatch: got ${v.amount} ${v.currency}` } });
    await audit({ businessId: txn.businessId, action: "billing.amount_mismatch", entityType: "BillingTransaction", entityId: txn.reference, metadata: { expected: txn.amount, got: v.amount, currency: v.currency } });
    logger.error("billing_amount_mismatch", { reference: v.reference, expected: txn.amount, got: v.amount });
    return "mismatch";
  }

  return db.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.billingTransaction.updateMany({
      where: { id: txn.id, appliedAt: null },
      data: { status: "SUCCESS", appliedAt: now, paidAt: v.paidAt ?? now, channel: v.channel, receiptNumber: `BZ-${txn.reference.slice(3).toUpperCase()}`, failureReason: null },
    });
    if (claimed.count === 0) return "already_applied" as const;

    const plan = await tx.plan.findUniqueOrThrow({ where: { code: txn.planCode } });
    const current = await tx.subscription.findUnique({ where: { businessId: txn.businessId }, include: { plan: true } });
    const currentPeriodEnd = computeNewPeriodEnd({ now, current, newPlan: plan, interval: txn.interval });
    await tx.subscription.upsert({
      where: { businessId: txn.businessId },
      create: { businessId: txn.businessId, planCode: plan.code, status: "ACTIVE", interval: txn.interval, currentPeriodEnd },
      update: { planCode: plan.code, status: "ACTIVE", interval: txn.interval, currentPeriodEnd, cancelAtPeriodEnd: false },
    });
    await audit(
      { businessId: txn.businessId, userId: txn.initiatedById, action: "billing.payment_success", entityType: "BillingTransaction", entityId: txn.reference, metadata: { plan: plan.code, interval: txn.interval, amount: txn.amount, periodEnd: currentPeriodEnd.toISOString() } },
      tx,
    );
    return "applied" as const;
  });
}

/** Ask Paystack for the truth about a reference, then apply it. */
export async function reconcileReference(reference: string): Promise<ApplyResult> {
  const v = await verifyTransaction(reference);
  return applyVerifiedTransaction(v);
}

/** Browser callback: only trusts the server-side verification, never the redirect itself. */
export async function handleCallback(ctx: Ctx, reference: string) {
  const txn = await db.billingTransaction.findFirst({ where: { reference, businessId: ctx.businessId } });
  if (!txn) throw new AppError("NOT_FOUND", "Payment not found for this business.");
  if (txn.appliedAt) return "already_applied" as const;
  return reconcileReference(reference);
}

export async function setCancelAtPeriodEnd(ctx: Ctx, cancel: boolean) {
  assertCan(ctx, "billing.manage");
  const sub = await db.subscription.findUnique({ where: { businessId: ctx.businessId } });
  if (!sub) throw new AppError("NOT_FOUND", "No subscription found.");
  const status = effectiveStatus(sub);
  if (cancel && status !== "ACTIVE") throw new AppError("CONFLICT", "Only an active paid subscription can be cancelled. Trials simply end without charge.");
  if (!cancel && status !== "CANCELED") throw new AppError("CONFLICT", "There is no scheduled cancellation to undo.");
  await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: cancel, status: cancel ? "CANCELED" : "ACTIVE" } });
  await audit({ businessId: ctx.businessId, userId: ctx.userId, action: cancel ? "billing.cancel" : "billing.resume", ip: ctx.ip });
}

export async function billingOverview(ctx: Ctx) {
  const [sub, plans, history] = await Promise.all([
    db.subscription.findUnique({ where: { businessId: ctx.businessId }, include: { plan: true } }),
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.billingTransaction.findMany({ where: { businessId: ctx.businessId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { sub, plans, history };
}
