import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DEFAULT_PLANS, TRIAL_DAYS, TRIAL_PLAN } from "@/lib/billing/plans";
import { int, optionalPhone, optionalText, text } from "@/lib/validation";
import { assertCan, type Ctx } from "./context";

export async function ensurePlans() {
  await db.plan.createMany({ data: DEFAULT_PLANS.map((p) => ({ ...p })), skipDuplicates: true });
}

const prefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,8}$/, "Use 1–8 letters, digits or dashes");

export const businessSchema = z.object({
  name: text(120, "Business name"),
  phone: optionalPhone,
  email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional()),
  address: optionalText(200),
  city: optionalText(80),
  tin: optionalText(30),
  defaultCreditDays: z.preprocess((v) => (v === "" || v == null ? 14 : v), int("Credit days", 0, 365)),
});

export async function createBusiness(userId: string, input: Record<string, unknown>, opts: { isDemo?: boolean; ip?: string | null } = {}) {
  const data = businessSchema.parse(input);
  await ensurePlans();
  const business = await db.$transaction(async (tx) => {
    const b = await tx.business.create({ data: { ...data, isDemo: opts.isDemo ?? false } });
    await tx.membership.create({ data: { userId, businessId: b.id, role: "OWNER" } });
    await tx.subscription.create({
      data: { businessId: b.id, planCode: TRIAL_PLAN, status: "TRIALING", trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) },
    });
    await audit({ businessId: b.id, userId, action: "business.create", entityType: "Business", entityId: b.id, metadata: { isDemo: b.isDemo }, ip: opts.ip }, tx);
    return b;
  });
  return business;
}

export const settingsSchema = businessSchema.extend({ invoicePrefix: prefix, receiptPrefix: prefix });

export async function updateBusinessSettings(ctx: Ctx, input: Record<string, unknown>) {
  assertCan(ctx, "settings.manage");
  const data = settingsSchema.parse(input);
  await db.business.update({
    where: { id: ctx.businessId },
    data: { ...data, phone: data.phone ?? null, email: data.email ?? null, address: data.address ?? null, city: data.city ?? null, tin: data.tin ?? null },
  });
  await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "business.settings_update", ip: ctx.ip });
}
