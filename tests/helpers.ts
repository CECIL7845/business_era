import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createBusiness } from "@/lib/services/business";
import type { Ctx } from "@/lib/services/context";
import type { Role } from "@/generated/prisma/enums";

let n = 0;
export const uniq = (p = "x") => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

export async function makeUser(overrides: { email?: string; verified?: boolean } = {}) {
  return db.user.create({
    data: {
      name: "Test User",
      email: overrides.email ?? `${uniq("u")}@example.com`,
      passwordHash: await hashPassword("password123"),
      emailVerifiedAt: overrides.verified === false ? null : new Date(),
    },
  });
}

/** A fresh business with an OWNER; returns the owner's ctx. */
export async function makeBusiness(name = "Biz") {
  const owner = await makeUser();
  const business = await createBusiness(owner.id, { name: `${name} ${uniq()}` });
  const m = await db.membership.findFirstOrThrow({ where: { businessId: business.id, userId: owner.id } });
  const ctx: Ctx = { userId: owner.id, businessId: business.id, membershipId: m.id, role: "OWNER" };
  return { owner, business, ctx };
}

export async function addMember(businessId: string, role: Role): Promise<Ctx> {
  const u = await makeUser();
  const m = await db.membership.create({ data: { userId: u.id, businessId, role } });
  return { userId: u.id, businessId, membershipId: m.id, role };
}

export const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
