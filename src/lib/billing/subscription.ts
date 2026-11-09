import type { Plan, Subscription } from "@/generated/prisma/client";
import { GRACE_DAYS } from "./plans";

export type SubscriptionWithPlan = Subscription & { plan: Plan };
export type EffectiveStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | "NONE";

const DAY = 86_400_000;

/**
 * Status computed from dates, so access is correct even if the daily cron has not
 * run yet. Stored status is only a cache of this for querying/reporting.
 */
export function effectiveStatus(sub: Subscription | null | undefined, now = new Date()): EffectiveStatus {
  if (!sub) return "NONE";
  const t = now.getTime();
  switch (sub.status) {
    case "TRIALING":
      return sub.trialEndsAt && sub.trialEndsAt.getTime() > t ? "TRIALING" : "EXPIRED";
    case "ACTIVE":
    case "PAST_DUE": {
      const end = sub.currentPeriodEnd?.getTime() ?? 0;
      if (end > t) return sub.cancelAtPeriodEnd ? "CANCELED" : "ACTIVE";
      if (!sub.cancelAtPeriodEnd && end + GRACE_DAYS * DAY > t) return "PAST_DUE";
      return "EXPIRED";
    }
    case "CANCELED":
      return sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > t ? "CANCELED" : "EXPIRED";
    default:
      return "EXPIRED";
  }
}

export type Entitlements = {
  status: EffectiveStatus;
  plan: Plan | null;
  canWrite: boolean;
  canExport: boolean;
  maxUsers: number;
  maxCustomers: number;
  /** When paid/trial access ends (before grace). */
  accessEndsAt: Date | null;
  daysLeft: number | null;
};

export function getEntitlements(sub: SubscriptionWithPlan | null | undefined, now = new Date()): Entitlements {
  const status = effectiveStatus(sub, now);
  const canWrite = status === "TRIALING" || status === "ACTIVE" || status === "PAST_DUE" || status === "CANCELED";
  const accessEndsAt = sub ? (sub.status === "TRIALING" ? sub.trialEndsAt : sub.currentPeriodEnd) : null;
  return {
    status,
    plan: sub?.plan ?? null,
    canWrite,
    canExport: canWrite && !!sub?.plan.canExport,
    maxUsers: sub?.plan.maxUsers ?? 1,
    maxCustomers: sub?.plan.maxCustomers ?? 0,
    accessEndsAt,
    daysLeft: accessEndsAt ? Math.ceil((accessEndsAt.getTime() - now.getTime()) / DAY) : null,
  };
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

/**
 * New period end after a successful payment.
 * - Same plan: extend from the later of now / current period end (early renewal keeps unused days).
 * - Plan change: unused paid days on the old plan are converted by value into days on the new plan.
 */
export function computeNewPeriodEnd(params: {
  now: Date;
  current: SubscriptionWithPlan | null;
  newPlan: Plan;
  interval: "MONTHLY" | "ANNUAL";
}): Date {
  const { now, current, newPlan, interval } = params;
  const months = interval === "ANNUAL" ? 12 : 1;
  const status = effectiveStatus(current, now);
  const hasPaidTime = current && (status === "ACTIVE" || status === "CANCELED") && current.currentPeriodEnd && current.currentPeriodEnd > now;
  if (!hasPaidTime) return addMonths(now, months);

  const end = current.currentPeriodEnd!;
  if (current.planCode === newPlan.code) return addMonths(end, months);

  const remainingMs = end.getTime() - now.getTime();
  const oldDaily = current.plan.priceMonthly / 30;
  const newDaily = newPlan.priceMonthly / 30;
  const convertedMs = newDaily > 0 ? Math.floor((remainingMs * oldDaily) / newDaily) : remainingMs;
  return addMonths(new Date(now.getTime() + convertedMs), months);
}
