import { describe, expect, it } from "vitest";
import { allocateFifo } from "@/lib/services/allocation";
import { addMonths, computeNewPeriodEnd, effectiveStatus, getEntitlements, type SubscriptionWithPlan } from "@/lib/billing/subscription";

describe("FIFO allocation", () => {
  it("settles oldest invoices first and tracks credit", () => {
    const r = allocateFifo(
      [
        { id: "a", total: 1000 },
        { id: "b", total: 500 },
        { id: "c", total: 700 },
      ],
      [
        { id: "p1", amount: 1200 },
        { id: "p2", amount: 1200 },
      ],
    );
    expect(Object.fromEntries(r.paid)).toEqual({ a: 1000, b: 500, c: 700 });
    expect(r.unallocated).toBe(200);
    expect(r.allocations).toEqual([
      { paymentId: "p1", invoiceId: "a", amount: 1000 },
      { paymentId: "p1", invoiceId: "b", amount: 200 },
      { paymentId: "p2", invoiceId: "b", amount: 300 },
      { paymentId: "p2", invoiceId: "c", amount: 700 },
    ]);
  });
  it("handles zero-total invoices and no payments", () => {
    expect(allocateFifo([{ id: "z", total: 0 }, { id: "a", total: 100 }], [{ id: "p", amount: 50 }]).paid.get("a")).toBe(50);
    expect(allocateFifo([{ id: "a", total: 100 }], []).allocations).toEqual([]);
    expect(allocateFifo([], [{ id: "p", amount: 50 }]).unallocated).toBe(50);
  });
  it("never allocates more than paid or owed (property check)", () => {
    for (let t = 0; t < 200; t++) {
      const inv = Array.from({ length: 1 + (t % 7) }, (_, i) => ({ id: `i${i}`, total: ((t * 37 + i * 101) % 900) + 1 }));
      const pay = Array.from({ length: t % 5 }, (_, i) => ({ id: `p${i}`, amount: ((t * 53 + i * 71) % 1200) + 1 }));
      const r = allocateFifo(inv, pay);
      const allocated = r.allocations.reduce((s, a) => s + a.amount, 0);
      expect(allocated + r.unallocated).toBe(pay.reduce((s, p) => s + p.amount, 0));
      for (const i of inv) expect(r.paid.get(i.id) ?? 0).toBeLessThanOrEqual(i.total);
    }
  });
});

const plan = (code: string, priceMonthly: number) => ({ code, name: code, priceMonthly, priceAnnual: priceMonthly * 10, maxUsers: 2, maxCustomers: 10, canExport: code !== "STARTER", isActive: true, sortOrder: 0, updatedAt: new Date() });
const sub = (o: Partial<SubscriptionWithPlan>): SubscriptionWithPlan =>
  ({ id: "s", businessId: "b", planCode: "GROWTH", status: "ACTIVE", interval: "MONTHLY", trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, createdAt: new Date(), updatedAt: new Date(), plan: plan("GROWTH", 24900), ...o }) as SubscriptionWithPlan;

describe("subscription status", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const day = 86_400_000;
  it("trial active then expired", () => {
    expect(effectiveStatus(sub({ status: "TRIALING", trialEndsAt: new Date(now.getTime() + day) }), now)).toBe("TRIALING");
    expect(effectiveStatus(sub({ status: "TRIALING", trialEndsAt: new Date(now.getTime() - 1) }), now)).toBe("EXPIRED");
  });
  it("active → grace (past due) → expired", () => {
    expect(effectiveStatus(sub({ currentPeriodEnd: new Date(now.getTime() + day) }), now)).toBe("ACTIVE");
    expect(effectiveStatus(sub({ currentPeriodEnd: new Date(now.getTime() - 3 * day) }), now)).toBe("PAST_DUE");
    expect(effectiveStatus(sub({ currentPeriodEnd: new Date(now.getTime() - 8 * day) }), now)).toBe("EXPIRED");
  });
  it("cancelled keeps access until period end, no grace", () => {
    expect(effectiveStatus(sub({ status: "CANCELED", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(now.getTime() + day) }), now)).toBe("CANCELED");
    expect(effectiveStatus(sub({ status: "CANCELED", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(now.getTime() - day) }), now)).toBe("EXPIRED");
  });
  it("entitlements are read-only when expired", () => {
    const e = getEntitlements(sub({ status: "TRIALING", trialEndsAt: new Date(now.getTime() - day) }), now);
    expect(e.canWrite).toBe(false);
    expect(e.canExport).toBe(false);
    expect(getEntitlements(null, now).canWrite).toBe(false);
  });
  it("adds calendar months, clamping to month end", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2026-11-15T00:00:00Z"), 12).toISOString()).toBe("2027-11-15T00:00:00.000Z");
  });
  it("renewal extends from period end; plan change converts remaining value", () => {
    const end = new Date(now.getTime() + 10 * day);
    const current = sub({ currentPeriodEnd: end });
    expect(computeNewPeriodEnd({ now, current, newPlan: plan("GROWTH", 24900), interval: "MONTHLY" }).toISOString()).toBe(addMonths(end, 1).toISOString());
    // Upgrade to a plan twice the price: 10 remaining days become 5.
    const up = computeNewPeriodEnd({ now, current: sub({ currentPeriodEnd: end, plan: plan("GROWTH", 20000) }), newPlan: plan("PRO", 40000), interval: "MONTHLY" });
    expect(up.toISOString()).toBe(addMonths(new Date(now.getTime() + 5 * day), 1).toISOString());
    // Trial or expired: starts now.
    expect(computeNewPeriodEnd({ now, current: sub({ status: "TRIALING", trialEndsAt: end }), newPlan: plan("GROWTH", 24900), interval: "ANNUAL" }).toISOString()).toBe(addMonths(now, 12).toISOString());
  });
});
