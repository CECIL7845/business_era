import "server-only";
import { db, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getEntitlements } from "@/lib/billing/subscription";

export async function loadEntitlements(businessId: string, client: Tx | typeof db = db) {
  const sub = await client.subscription.findUnique({ where: { businessId }, include: { plan: true } });
  return getEntitlements(sub);
}

/** Expired/cancelled subscriptions become read-only: data stays visible and exportable by the owner, but no new records. */
export async function assertWritable(businessId: string, client: Tx | typeof db = db) {
  const ent = await loadEntitlements(businessId, client);
  if (!ent.canWrite) {
    throw new AppError("SUBSCRIPTION_INACTIVE", "Your subscription has ended, so your account is read-only. Renew on the Billing page to keep recording sales and payments.");
  }
  return ent;
}

export async function assertCanAddCustomer(businessId: string, client: Tx | typeof db = db) {
  const ent = await assertWritable(businessId, client);
  if (ent.maxCustomers >= 0) {
    const count = await client.customer.count({ where: { businessId, isActive: true } });
    if (count >= ent.maxCustomers) {
      throw new AppError("PLAN_LIMIT", `Your ${ent.plan?.name ?? ""} plan allows ${ent.maxCustomers} active customers. Upgrade on the Billing page or deactivate old customers.`);
    }
  }
}

export async function assertCanAddMember(businessId: string, client: Tx | typeof db = db) {
  const ent = await assertWritable(businessId, client);
  const [members, pending] = await Promise.all([
    client.membership.count({ where: { businessId } }),
    client.invitation.count({ where: { businessId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  if (members + pending >= ent.maxUsers) {
    throw new AppError("PLAN_LIMIT", `Your ${ent.plan?.name ?? ""} plan allows ${ent.maxUsers} users (including pending invitations). Upgrade on the Billing page to add more staff.`);
  }
}
