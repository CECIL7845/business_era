import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/auth/permissions";
import { checkbox, int, optionalMoney, optionalPhone, optionalText, text } from "@/lib/validation";
import { assertCan, type Ctx } from "./context";
import { assertCanAddCustomer, assertWritable } from "./entitlements";

export const customerSchema = z.object({
  name: text(120, "Customer / shop name"),
  contactName: optionalText(100),
  phone: optionalPhone,
  location: optionalText(150),
  creditLimit: optionalMoney("Credit limit"),
  paymentTermsDays: z.preprocess((v) => (v === "" || v == null ? undefined : v), int("Payment terms", 0, 365).optional()),
  notes: optionalText(1000),
  assignedToId: optionalText(64),
  isActive: checkbox.optional(),
});

async function validateAssignee(ctx: Ctx, assignedToId: string | undefined) {
  if (!assignedToId) return null;
  const m = await db.membership.findFirst({ where: { id: assignedToId, businessId: ctx.businessId } });
  if (!m) throw new AppError("VALIDATION", "Choose a valid team member.", { assignedToId: "Not a member of this business" });
  return m.id;
}

export async function createCustomer(ctx: Ctx, input: Record<string, unknown>) {
  assertCan(ctx, "customers.manage");
  const data = customerSchema.parse(input);
  await assertCanAddCustomer(ctx.businessId);
  const business = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
  // Sales staff can add customers but only owners/managers approve credit.
  const creditLimit = can(ctx.role, "customers.setCreditLimit") ? (data.creditLimit ?? 0) : 0;
  const assignedToId = (await validateAssignee(ctx, data.assignedToId)) ?? (ctx.role === "SALES" ? ctx.membershipId : null);
  const customer = await db.customer.create({
    data: {
      businessId: ctx.businessId,
      name: data.name,
      contactName: data.contactName,
      phone: data.phone,
      location: data.location,
      creditLimit,
      paymentTermsDays: data.paymentTermsDays ?? business.defaultCreditDays,
      notes: data.notes,
      assignedToId,
    },
  });
  await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "customer.create", entityType: "Customer", entityId: customer.id, metadata: { creditLimit }, ip: ctx.ip });
  return customer;
}

export async function updateCustomer(ctx: Ctx, customerId: string, input: Record<string, unknown>) {
  assertCan(ctx, "customers.manage");
  const data = customerSchema.parse(input);
  await assertWritable(ctx.businessId);
  const existing = await db.customer.findFirst({ where: { id: customerId, businessId: ctx.businessId } });
  if (!existing) throw new AppError("NOT_FOUND", "Customer not found.");
  const canSetLimit = can(ctx.role, "customers.setCreditLimit");
  const creditLimit = canSetLimit && data.creditLimit !== undefined ? data.creditLimit : existing.creditLimit;
  const isActive = data.isActive ?? existing.isActive;
  if (isActive && !existing.isActive) await assertCanAddCustomer(ctx.businessId);
  await db.customer.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      contactName: data.contactName ?? null,
      phone: data.phone ?? null,
      location: data.location ?? null,
      creditLimit,
      paymentTermsDays: data.paymentTermsDays ?? existing.paymentTermsDays,
      notes: data.notes ?? null,
      assignedToId: await validateAssignee(ctx, data.assignedToId),
      isActive,
    },
  });
  await audit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    action: creditLimit !== existing.creditLimit ? "customer.credit_limit_change" : "customer.update",
    entityType: "Customer",
    entityId: existing.id,
    metadata: creditLimit !== existing.creditLimit ? { from: existing.creditLimit, to: creditLimit } : undefined,
    ip: ctx.ip,
  });
}

export async function getCustomer(ctx: Ctx, customerId: string) {
  assertCan(ctx, "customers.view");
  const customer = await db.customer.findFirst({
    where: { id: customerId, businessId: ctx.businessId },
    include: { assignedTo: { include: { user: { select: { name: true } } } } },
  });
  if (!customer) throw new AppError("NOT_FOUND", "Customer not found.");
  return customer;
}

/** Lightweight list for pickers (invoice/payment forms). */
export async function customerOptions(ctx: Ctx) {
  assertCan(ctx, "customers.view");
  return db.customer.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    select: { id: true, name: true, location: true, creditLimit: true, paymentTermsDays: true },
    orderBy: { name: "asc" },
    take: 5000,
  });
}
