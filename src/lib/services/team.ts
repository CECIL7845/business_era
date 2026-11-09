import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { appUrl, sendEmail } from "@/lib/email";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { email } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertCan, type Ctx } from "./context";
import { assertCanAddMember, assertWritable } from "./entitlements";

const roleSchema = z.enum(["OWNER", "MANAGER", "SALES", "VIEWER"], { error: "Choose a role" });
const INVITE_DAYS = 7;

export async function inviteMember(ctx: Ctx, input: Record<string, unknown>, inviter: { name: string; emailVerified: boolean }) {
  assertCan(ctx, "team.manage");
  const data = z.object({ email, role: roleSchema }).parse(input);
  if (!inviter.emailVerified) throw new AppError("FORBIDDEN", "Please confirm your own email address before inviting staff.");
  if (data.role === "OWNER" && ctx.role !== "OWNER") throw new AppError("FORBIDDEN", "Only an owner can invite another owner.");
  await enforceRateLimit(`invite:${ctx.businessId}`, 30, 86_400, "Too many invitations today. Please try again tomorrow.");
  await assertCanAddMember(ctx.businessId);

  const existingMember = await db.membership.findFirst({ where: { businessId: ctx.businessId, user: { email: data.email } } });
  if (existingMember) throw new AppError("CONFLICT", "This person is already a member of your business.", { email: "Already a member" });

  const token = randomToken(32);
  const business = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
  await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({ where: { businessId: ctx.businessId, email: data.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const inv = await tx.invitation.create({
      data: { businessId: ctx.businessId, email: data.email, role: data.role, tokenHash: sha256(token), invitedById: ctx.userId, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) },
    });
    await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "team.invite", entityType: "Invitation", entityId: inv.id, metadata: { email: data.email, role: data.role }, ip: ctx.ip }, tx);
  });
  await sendEmail({
    to: data.email,
    subject: `${inviter.name} invited you to ${business.name} on Businestra`,
    text: `Hello,\n\n${inviter.name} has invited you to join ${business.name} on Businestra as ${ROLE_LABELS[data.role]}.\n\nAccept the invitation here (expires in ${INVITE_DAYS} days):\n${appUrl(`/invite/${token}`)}\n\nIf you weren't expecting this, you can ignore this email.\n\n— Businestra`,
  });
  return { token };
}

export async function getInvitation(token: string) {
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { business: { select: { name: true } } } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) return null;
  return inv;
}

export async function acceptInvitation(user: { id: string; email: string }, token: string, ip?: string | null) {
  const inv = await getInvitation(token);
  if (!inv) throw new AppError("NOT_FOUND", "This invitation is invalid, already used, or expired. Ask for a new one.");
  if (inv.email !== user.email.toLowerCase()) {
    throw new AppError("FORBIDDEN", `This invitation was sent to ${inv.email}. Sign in with that email address to accept it.`);
  }
  await assertWritable(inv.businessId);
  return db.$transaction(async (tx) => {
    // Claim the invitation atomically so it can only be used once.
    const claimed = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "This invitation has already been used.");
    const existing = await tx.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId: inv.businessId } } });
    if (existing) return existing;
    const m = await tx.membership.create({ data: { userId: user.id, businessId: inv.businessId, role: inv.role } });
    await audit({ businessId: inv.businessId, userId: user.id, action: "team.join", entityType: "Membership", entityId: m.id, metadata: { role: inv.role }, ip }, tx);
    return m;
  });
}

async function loadTarget(ctx: Ctx, membershipId: string) {
  const target = await db.membership.findFirst({ where: { id: membershipId, businessId: ctx.businessId } });
  if (!target) throw new AppError("NOT_FOUND", "Team member not found.");
  if (target.role === "OWNER" && ctx.role !== "OWNER") throw new AppError("FORBIDDEN", "Only an owner can change another owner.");
  return target;
}

async function assertNotLastOwner(businessId: string, membershipId: string) {
  const owners = await db.membership.count({ where: { businessId, role: "OWNER", id: { not: membershipId } } });
  if (owners === 0) throw new AppError("CONFLICT", "A business must keep at least one owner. Make someone else an owner first.");
}

export async function changeMemberRole(ctx: Ctx, membershipId: string, rawRole: string) {
  assertCan(ctx, "team.manage");
  const role = roleSchema.parse(rawRole);
  const target = await loadTarget(ctx, membershipId);
  if (role === "OWNER" && ctx.role !== "OWNER") throw new AppError("FORBIDDEN", "Only an owner can make someone an owner.");
  if (target.role === "OWNER" && role !== "OWNER") await assertNotLastOwner(ctx.businessId, target.id);
  await db.membership.update({ where: { id: target.id }, data: { role } });
  await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "team.role_change", entityType: "Membership", entityId: target.id, metadata: { from: target.role, to: role }, ip: ctx.ip });
}

export async function removeMember(ctx: Ctx, membershipId: string) {
  assertCan(ctx, "team.manage");
  const target = await loadTarget(ctx, membershipId);
  if (target.role === "OWNER") await assertNotLastOwner(ctx.businessId, target.id);
  await db.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: target.id } });
    // Revoke their sessions' access to this business immediately.
    await tx.session.updateMany({ where: { userId: target.userId, activeBusinessId: ctx.businessId }, data: { activeBusinessId: null } });
    await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "team.remove", entityType: "Membership", entityId: target.id, metadata: { removedUserId: target.userId }, ip: ctx.ip }, tx);
  });
}

export async function revokeInvitation(ctx: Ctx, invitationId: string) {
  assertCan(ctx, "team.manage");
  const res = await db.invitation.updateMany({ where: { id: invitationId, businessId: ctx.businessId, acceptedAt: null }, data: { revokedAt: new Date() } });
  if (res.count === 0) throw new AppError("NOT_FOUND", "Invitation not found.");
  await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "team.invite_revoke", entityType: "Invitation", entityId: invitationId, ip: ctx.ip });
}
