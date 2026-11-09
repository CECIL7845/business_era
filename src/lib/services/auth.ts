import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { appUrl, sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { burnPasswordCheck, hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { email, optionalPhone, text } from "@/lib/validation";
import { enforceRateLimit, resetRateLimit } from "@/lib/rate-limit";

const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

export const registerSchema = z.object({
  name: text(100, "Your name"),
  email,
  phone: optionalPhone,
  password: passwordSchema,
});

export async function registerUser(input: Record<string, unknown>, ip?: string | null) {
  const data = registerSchema.parse(input);
  await enforceRateLimit(`register:${ip ?? "unknown"}`, 10, 3600);
  const exists = await db.user.findUnique({ where: { email: data.email } });
  if (exists) throw new AppError("CONFLICT", "An account with this email already exists. Sign in or reset your password.", { email: "Email already registered" });
  const user = await db.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, passwordHash: await hashPassword(data.password) },
  });
  await audit({ userId: user.id, action: "user.register", ip });
  await sendVerificationEmail(user.id, user.email, user.name);
  return user;
}

export async function authenticate(rawEmail: string, password: string, ip?: string | null) {
  const parsed = email.safeParse(rawEmail);
  if (!parsed.success || !password) throw new AppError("VALIDATION", "Enter your email and password.");
  await enforceRateLimit(`login-ip:${ip ?? "unknown"}`, 30, 900);
  await enforceRateLimit(`login-email:${parsed.data}`, 10, 900);

  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("RATE_LIMITED", "This account is temporarily locked after too many failed attempts. Try again in 15 minutes or reset your password.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLoginCount: failed },
    });
    await audit({ userId: user.id, action: "user.login_failed", ip });
    throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
  }
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await resetRateLimit(`login-email:${parsed.data}`);
  await audit({ userId: user.id, action: "user.login", ip });
  return user;
}

async function issueToken(userId: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD", ttlMinutes: number) {
  const token = randomToken(32);
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }); // invalidate older tokens
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return token;
}

export async function sendVerificationEmail(userId: string, to: string, name: string) {
  const token = await issueToken(userId, "VERIFY_EMAIL", 60 * 48);
  await sendEmail({
    to,
    subject: "Confirm your Businestra email",
    text: `Hello ${name},\n\nPlease confirm your email address by opening this link:\n${appUrl(`/verify-email?token=${token}`)}\n\nThe link expires in 48 hours. If you did not create a Businestra account, ignore this email.\n\n— Businestra`,
  });
}

export async function verifyEmailToken(token: string) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== "VERIFY_EMAIL" || row.usedAt || row.expiresAt < new Date()) return false;
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return true;
}

/** Always behaves the same whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(rawEmail: string, ip?: string | null) {
  const parsed = email.safeParse(rawEmail);
  if (!parsed.success) throw new AppError("VALIDATION", "Enter a valid email address.", { email: "Enter a valid email address" });
  await enforceRateLimit(`reset-ip:${ip ?? "unknown"}`, 10, 3600);
  await enforceRateLimit(`reset-email:${parsed.data}`, 3, 3600);
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (!user) return;
  const token = await issueToken(user.id, "RESET_PASSWORD", 60);
  await audit({ userId: user.id, action: "user.password_reset_requested", ip });
  await sendEmail({
    to: user.email,
    subject: "Reset your Businestra password",
    text: `Hello ${user.name},\n\nSomeone (hopefully you) asked to reset your Businestra password. Open this link to choose a new one:\n${appUrl(`/reset-password?token=${token}`)}\n\nThe link expires in 1 hour and can be used once. If you did not ask for this, you can ignore this email — your password will not change.\n\n— Businestra`,
  });
}

export async function resetPassword(token: string, newPassword: string, ip?: string | null) {
  const password = passwordSchema.parse(newPassword);
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== "RESET_PASSWORD" || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError("VALIDATION", "This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // Reset also proves control of the inbox, and clears any lockout.
    db.user.update({ where: { id: row.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: row.userId } }), // sign out everywhere
  ]);
  await audit({ userId: row.userId, action: "user.password_reset", ip });
  return row.userId;
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string, ip?: string | null) {
  const password = passwordSchema.parse(next);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new AppError("VALIDATION", "Current password is incorrect.", { currentPassword: "Incorrect password" });
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  await audit({ userId, action: "user.password_changed", ip });
}

export const profileSchema = z.object({ name: text(100, "Name"), phone: optionalPhone });

export async function updateProfile(userId: string, input: Record<string, unknown>) {
  const data = profileSchema.parse(input);
  await db.user.update({ where: { id: userId }, data: { name: data.name, phone: data.phone ?? null } });
}
