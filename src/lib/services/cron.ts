import "server-only";
import { db } from "@/lib/db";
import { addDays, formatDate } from "@/lib/dates";
import { appUrl, sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { effectiveStatus } from "@/lib/billing/subscription";
import { paystackConfigured } from "@/lib/billing/paystack";
import { hit } from "@/lib/rate-limit";
import { reconcileReference } from "./billing";

/** Daily maintenance. Idempotent: safe to run more than once a day. */
export async function runDailyJobs(now = new Date()) {
  const result = { statusUpdated: 0, remindersSent: 0, reconciled: 0, cleaned: 0 };

  // 1. Persist computed subscription status (access checks already use computed status).
  const subs = await db.subscription.findMany({ include: { business: { select: { id: true, name: true, isDemo: true } } } });
  for (const s of subs) {
    const eff = effectiveStatus(s, now);
    const stored = eff === "NONE" ? s.status : eff;
    if (stored !== s.status) {
      await db.subscription.update({ where: { id: s.id }, data: { status: stored } });
      result.statusUpdated++;
    }
    // 2. Renewal reminders 3 days before and on the day access ends (manual MoMo renewals).
    const end = s.status === "TRIALING" ? s.trialEndsAt : s.currentPeriodEnd;
    if (!end || s.business.isDemo || s.cancelAtPeriodEnd) continue;
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft !== 3 && daysLeft !== 1) continue;
    const once = await hit(`reminder:${s.id}:${end.toISOString().slice(0, 10)}:${daysLeft}`, 7 * 86_400);
    if (once !== 1) continue;
    const owners = await db.membership.findMany({ where: { businessId: s.businessId, role: "OWNER" }, include: { user: true } });
    for (const o of owners) {
      await sendEmail({
        to: o.user.email,
        subject: `${s.business.name}: your Businestra ${s.status === "TRIALING" ? "trial" : "subscription"} ends ${formatDate(end)}`,
        text: `Hello ${o.user.name},\n\nYour Businestra ${s.status === "TRIALING" ? "free trial" : "subscription"} for ${s.business.name} ends on ${formatDate(end)}.\n\nRenew with Mobile Money or card here: ${appUrl("/app/billing")}\n\nIf it lapses, your records stay safe and visible but the account becomes read-only until you renew.\n\n— Businestra`,
      });
      result.remindersSent++;
    }
  }

  // 3. Reconcile checkouts whose webhook may have been missed.
  if (paystackConfigured()) {
    const pending = await db.billingTransaction.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 10 * 60_000), gt: addDays(now, -3) } }, take: 100 });
    for (const p of pending) {
      try {
        await reconcileReference(p.reference);
        result.reconciled++;
      } catch (err) {
        logger.warn("reconcile_failed", { reference: p.reference, err });
      }
    }
    await db.billingTransaction.updateMany({ where: { status: "PENDING", createdAt: { lt: addDays(now, -3) } }, data: { status: "ABANDONED" } });
  }

  // 4. Housekeeping.
  const [s1, s2, s3] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.authToken.deleteMany({ where: { expiresAt: { lt: addDays(now, -7) } } }),
    db.rateLimit.deleteMany({ where: { windowStart: { lt: addDays(now, -8) } } }),
  ]);
  result.cleaned = s1.count + s2.count + s3.count;
  logger.info("daily_jobs_done", result);
  return result;
}
