import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { applyVerifiedTransaction, handleCallback, reconcileReference, setCancelAtPeriodEnd } from "@/lib/services/billing";
import { verifyWebhookSignature } from "@/lib/billing/paystack";
import { assertWritable, loadEntitlements } from "@/lib/services/entitlements";
import { createCustomer } from "@/lib/services/customers";
import { exportCsv } from "@/lib/services/reports";
import { runDailyJobs } from "@/lib/services/cron";
import { addMember, makeBusiness, uniq } from "../helpers";

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_dummy_for_tests";
});
afterEach(() => vi.unstubAllGlobals());

async function pendingTxn(businessId: string, userId: string, planCode = "GROWTH", amount = 24_900) {
  return db.billingTransaction.create({ data: { businessId, reference: `bz_${uniq()}`, planCode, interval: "MONTHLY", amount, initiatedById: userId } });
}
const success = (reference: string, amount = 24_900) => ({ reference, status: "success", amount, currency: "GHS", channel: "mobile_money", paidAt: new Date(), gatewayResponse: "Approved" });

describe("subscription billing", () => {
  it("new businesses start on a 14-day Growth trial", async () => {
    const { business } = await makeBusiness();
    const ent = await loadEntitlements(business.id);
    expect(ent.status).toBe("TRIALING");
    expect(ent.plan?.code).toBe("GROWTH");
    expect(ent.daysLeft).toBe(14);
  });

  it("verifies Paystack webhook signatures over the raw body", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "x" } });
    const sig = createHmac("sha512", "sk_test_dummy_for_tests").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig)).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("applies a verified payment exactly once, even with concurrent duplicate deliveries", async () => {
    const { business, ctx } = await makeBusiness();
    const txn = await pendingTxn(business.id, ctx.userId);
    const results = await Promise.all([applyVerifiedTransaction(success(txn.reference)), applyVerifiedTransaction(success(txn.reference)), applyVerifiedTransaction(success(txn.reference))]);
    expect(results.filter((r) => r === "applied")).toHaveLength(1);
    expect(results.filter((r) => r === "already_applied")).toHaveLength(2);
    const sub = await db.subscription.findUniqueOrThrow({ where: { businessId: business.id } });
    expect(sub.status).toBe("ACTIVE");
    const days = Math.round((sub.currentPeriodEnd!.getTime() - Date.now()) / 86_400_000);
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
    expect(await db.auditLog.count({ where: { entityId: txn.reference, action: "billing.payment_success" } })).toBe(1);
  });

  it("rejects amount mismatches and records failures without granting access", async () => {
    const { business, ctx } = await makeBusiness();
    const t1 = await pendingTxn(business.id, ctx.userId);
    expect(await applyVerifiedTransaction(success(t1.reference, 100))).toBe("mismatch");
    const t2 = await pendingTxn(business.id, ctx.userId);
    expect(await applyVerifiedTransaction({ ...success(t2.reference), status: "failed", gatewayResponse: "Insufficient funds" })).toBe("failed");
    expect((await db.billingTransaction.findUniqueOrThrow({ where: { id: t2.id } })).status).toBe("FAILED");
    expect(await applyVerifiedTransaction({ ...success(t2.reference), status: "ongoing" })).toBe("pending");
    expect(await applyVerifiedTransaction(success("bz_unknown"))).toBe("unknown_reference");
    expect((await db.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("TRIALING");
  });

  it("callback only trusts server-side verification, and only for the caller's business", async () => {
    const a = await makeBusiness();
    const b = await makeBusiness();
    const txn = await pendingTxn(a.business.id, a.ctx.userId);
    await expect(handleCallback(b.ctx, txn.reference)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Provider says still pending → no access granted even though the browser came back.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: true, data: { reference: txn.reference, status: "abandoned", amount: 24_900, currency: "GHS" } }))));
    expect(await handleCallback(a.ctx, txn.reference)).toBe("failed");
    expect((await loadEntitlements(a.business.id)).status).toBe("TRIALING");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: true, data: { reference: txn.reference, status: "success", amount: 24_900, currency: "GHS", channel: "mobile_money", paid_at: new Date().toISOString() } }))));
    // A failed status can still be superseded by a later verified success (e.g. MoMo approval arrived late).
    await db.billingTransaction.update({ where: { id: txn.id }, data: { status: "PENDING" } });
    expect(await reconcileReference(txn.reference)).toBe("applied");
    expect((await loadEntitlements(a.business.id)).status).toBe("ACTIVE");
  });

  it("expired subscriptions become read-only but owners can still export their data", async () => {
    const { business, ctx } = await makeBusiness();
    await db.subscription.update({ where: { businessId: business.id }, data: { trialEndsAt: new Date(Date.now() - 1000) } });
    await expect(assertWritable(business.id)).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
    await expect(createCustomer(ctx, { name: "x" })).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
    expect((await exportCsv(ctx, "customers")).csv).toContain("Customer");
    const viewer = await addMember(business.id, "VIEWER");
    await expect(exportCsv(viewer, "customers")).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    const res = await runDailyJobs();
    expect(res.statusUpdated).toBeGreaterThanOrEqual(1);
    expect((await db.subscription.findUniqueOrThrow({ where: { businessId: business.id } })).status).toBe("EXPIRED");
  });

  it("enforces plan customer limits and supports cancel/resume", async () => {
    const { business, ctx } = await makeBusiness();
    await db.subscription.update({ where: { businessId: business.id }, data: { planCode: "STARTER", status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000) } });
    await db.plan.update({ where: { code: "STARTER" }, data: { maxCustomers: 2 } });
    try {
      await createCustomer(ctx, { name: "one" });
      await createCustomer(ctx, { name: "two" });
      await expect(createCustomer(ctx, { name: "three" })).rejects.toMatchObject({ code: "PLAN_LIMIT" });
      await expect(exportCsv(ctx, "invoices")).rejects.toMatchObject({ code: "PLAN_LIMIT" }); // Starter has no export
    } finally {
      await db.plan.update({ where: { code: "STARTER" }, data: { maxCustomers: 150 } });
    }
    await setCancelAtPeriodEnd(ctx, true);
    expect((await loadEntitlements(business.id)).status).toBe("CANCELED");
    expect((await loadEntitlements(business.id)).canWrite).toBe(true);
    await setCancelAtPeriodEnd(ctx, false);
    expect((await loadEntitlements(business.id)).status).toBe("ACTIVE");
    const manager = await addMember(business.id, "MANAGER");
    await expect(setCancelAtPeriodEnd(manager, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
