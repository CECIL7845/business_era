import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { addDays } from "@/lib/dates";
import { effectiveStatus } from "@/lib/billing/subscription";
import { int, money } from "@/lib/validation";

type Admin = { userId: string; ip?: string | null };

export async function platformMetrics() {
  const since7 = addDays(new Date(), -7);
  const since30 = addDays(new Date(), -30);
  const [businesses, subs, signups7, invoices7, payments7, revenue30, activeBiz7, feedbackNew] = await Promise.all([
    db.business.count({ where: { isDemo: false } }),
    db.subscription.findMany({ where: { business: { isDemo: false } }, include: { plan: true } }),
    db.user.count({ where: { createdAt: { gte: since7 } } }),
    db.invoice.count({ where: { createdAt: { gte: since7 }, business: { isDemo: false } } }),
    db.payment.count({ where: { createdAt: { gte: since7 }, business: { isDemo: false } } }),
    db.billingTransaction.aggregate({ where: { status: "SUCCESS", paidAt: { gte: since30 }, business: { isDemo: false } }, _sum: { amount: true } }),
    db.invoice.groupBy({ by: ["businessId"], where: { createdAt: { gte: since7 }, business: { isDemo: false } } }),
    db.feedback.count({ where: { status: "NEW" } }),
  ]);
  const byStatus: Record<string, number> = {};
  let mrr = 0;
  for (const s of subs) {
    const st = effectiveStatus(s);
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    if (st === "ACTIVE" || st === "PAST_DUE") mrr += s.interval === "ANNUAL" ? Math.round(s.plan.priceAnnual / 12) : s.plan.priceMonthly;
  }
  return { businesses, byStatus, mrr, signups7, invoices7, payments7, revenue30: revenue30._sum.amount ?? 0, activeBusinesses7: activeBiz7.length, feedbackNew };
}

export async function listBusinesses(q?: string) {
  return db.business.findMany({
    where: q ? { name: { contains: q.slice(0, 100), mode: "insensitive" } } : undefined,
    include: { subscription: { include: { plan: true } }, _count: { select: { memberships: true, customers: true, invoices: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

const adjustSchema = z.object({
  businessId: z.string().min(1),
  planCode: z.string().min(1),
  days: int("Days", 1, 800),
  note: z.string().trim().min(3, "Add a note (e.g. 'Paid GHS 249 by MoMo, ref 123')").max(300),
});

/** Manual activation for offline payments (bank transfer, cash) — always audited. */
export async function adminGrantAccess(admin: Admin, input: Record<string, unknown>) {
  const data = adjustSchema.parse(input);
  const plan = await db.plan.findUnique({ where: { code: data.planCode } });
  if (!plan) throw new AppError("VALIDATION", "Unknown plan.");
  const sub = await db.subscription.findUnique({ where: { businessId: data.businessId } });
  const base = sub?.currentPeriodEnd && sub.currentPeriodEnd > new Date() && sub.status !== "TRIALING" ? sub.currentPeriodEnd : new Date();
  const currentPeriodEnd = addDays(base, data.days);
  await db.subscription.upsert({
    where: { businessId: data.businessId },
    create: { businessId: data.businessId, planCode: plan.code, status: "ACTIVE", currentPeriodEnd },
    update: { planCode: plan.code, status: "ACTIVE", currentPeriodEnd, cancelAtPeriodEnd: false },
  });
  await audit({ businessId: data.businessId, userId: admin.userId, action: "admin.grant_access", metadata: { plan: plan.code, days: data.days, note: data.note, periodEnd: currentPeriodEnd.toISOString() }, ip: admin.ip });
}

export async function adminExtendTrial(admin: Admin, businessId: string, rawDays: unknown) {
  const days = int("Days", 1, 60).parse(rawDays);
  const sub = await db.subscription.findUnique({ where: { businessId } });
  if (!sub || sub.status !== "TRIALING") throw new AppError("CONFLICT", "Only trials can be extended.");
  const base = sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date();
  await db.subscription.update({ where: { id: sub.id }, data: { trialEndsAt: addDays(base, days) } });
  await audit({ businessId, userId: admin.userId, action: "admin.extend_trial", metadata: { days }, ip: admin.ip });
}

const planEditSchema = z.object({ code: z.string().min(1), priceMonthly: money("Monthly price"), priceAnnual: money("Annual price"), maxUsers: int("Max users", 1, 1000), maxCustomers: int("Max customers", -1, 1_000_000) });

export async function adminUpdatePlan(admin: Admin, input: Record<string, unknown>) {
  const data = planEditSchema.parse(input);
  const before = await db.plan.findUnique({ where: { code: data.code } });
  if (!before) throw new AppError("NOT_FOUND", "Plan not found.");
  await db.plan.update({ where: { code: data.code }, data: { priceMonthly: data.priceMonthly, priceAnnual: data.priceAnnual, maxUsers: data.maxUsers, maxCustomers: data.maxCustomers } });
  await audit({ userId: admin.userId, action: "admin.plan_update", entityType: "Plan", entityId: data.code, metadata: { before: { m: before.priceMonthly, a: before.priceAnnual, u: before.maxUsers, c: before.maxCustomers }, after: { m: data.priceMonthly, a: data.priceAnnual, u: data.maxUsers, c: data.maxCustomers } }, ip: admin.ip });
}

export async function adminSetFeedbackStatus(admin: Admin, id: string, rawStatus: unknown) {
  const status = z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]).parse(rawStatus);
  await db.feedback.update({ where: { id }, data: { status } });
  await audit({ userId: admin.userId, action: "admin.feedback_status", entityType: "Feedback", entityId: id, metadata: { status }, ip: admin.ip });
}
