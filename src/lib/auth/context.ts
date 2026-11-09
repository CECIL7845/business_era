import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSession, requestMeta } from "./session";
import type { Ctx } from "@/lib/services/context";
import { getEntitlements } from "@/lib/billing/subscription";

export const getCurrentUser = cache(async () => (await getSession())?.user ?? null);

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return { session, user: session.user };
}

/**
 * Resolves the signed-in user's active business and verifies membership on every
 * request. The business id never comes from the client — only from the session,
 * after checking a Membership row exists.
 */
export const requireBusiness = cache(async () => {
  const { session, user } = await requireUser();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { business: { include: { subscription: { include: { plan: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/onboarding");
  const membership = memberships.find((m) => m.businessId === session.activeBusinessId) ?? memberships[0];
  if (membership.businessId !== session.activeBusinessId) {
    await db.session.update({ where: { id: session.id }, data: { activeBusinessId: membership.businessId } });
  }
  const { ip } = await requestMeta();
  const ctx: Ctx = { userId: user.id, businessId: membership.businessId, membershipId: membership.id, role: membership.role, ip };
  const entitlements = getEntitlements(membership.business.subscription);
  return { session, user, membership, business: membership.business, memberships, ctx, entitlements };
});

export async function requirePlatformAdmin() {
  const { user, session } = await requireUser();
  if (!user.isPlatformAdmin) redirect("/app");
  const { ip } = await requestMeta();
  return { user, session, ip };
}
