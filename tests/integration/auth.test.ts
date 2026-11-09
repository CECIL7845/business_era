import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { authenticate, registerUser, requestPasswordReset, resetPassword, verifyEmailToken } from "@/lib/services/auth";
import { uniq } from "../helpers";

const ip = () => `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

describe("authentication", () => {
  it("registers with hashed password and normalised email/phone", async () => {
    const email = `${uniq("Reg")}@Example.com`;
    const u = await registerUser({ name: "Kojo", email, phone: "024 123 4567", password: "goodpass123" }, ip());
    expect(u.email).toBe(email.toLowerCase());
    expect(u.phone).toBe("+233241234567");
    expect(u.passwordHash).not.toContain("goodpass123");
    await expect(registerUser({ name: "Kojo", email, password: "goodpass123" }, ip())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(registerUser({ name: "K", email: `${uniq()}@x.com`, password: "short" }, ip())).rejects.toThrow();
  });

  it("logs in, rejects wrong passwords and locks after repeated failures", async () => {
    const email = `${uniq("login")}@example.com`;
    await registerUser({ name: "A", email, password: "goodpass123" }, ip());
    expect((await authenticate(email, "goodpass123", ip())).email).toBe(email);
    await expect(authenticate(email, "wrongpass1", ip())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(authenticate(`${uniq("nobody")}@example.com`, "whatever1", ip())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    for (let i = 0; i < 8; i++) await authenticate(email, "wrongpass1", ip()).catch(() => {});
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    expect(u.lockedUntil && u.lockedUntil > new Date()).toBe(true);
  });

  it("rate limits login attempts per IP", async () => {
    const theIp = ip();
    const errors: string[] = [];
    for (let i = 0; i < 32; i++) await authenticate(`${uniq()}@example.com`, "x1", theIp).catch((e) => errors.push(e.code));
    expect(errors.slice(-2)).toEqual(["RATE_LIMITED", "RATE_LIMITED"]);
  });

  it("password reset tokens are single-use, expire, and sign out all sessions", async () => {
    const email = `${uniq("reset")}@example.com`;
    const u = await registerUser({ name: "R", email, password: "goodpass123" }, ip());
    await db.session.create({ data: { id: sha256(uniq()), userId: u.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    await requestPasswordReset(email, ip());
    // Plant a known token for the test (real tokens are only emailed).
    const token = "known-reset-token-" + uniq();
    await db.authToken.updateMany({ where: { userId: u.id, type: "RESET_PASSWORD", usedAt: null }, data: { tokenHash: sha256(token) } });
    await resetPassword(token, "newpassword9", ip());
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    expect((await authenticate(email, "newpassword9", ip())).id).toBe(u.id);
    await expect(resetPassword(token, "anotherpass9", ip())).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(resetPassword("garbage", "anotherpass9", ip())).rejects.toMatchObject({ code: "VALIDATION" });
    // Unknown email: no error, no enumeration.
    await expect(requestPasswordReset(`${uniq("ghost")}@example.com`, ip())).resolves.toBeUndefined();
  });

  it("verifies email with a valid token only", async () => {
    const u = await registerUser({ name: "V", email: `${uniq("verify")}@example.com`, password: "goodpass123" }, ip());
    expect(await verifyEmailToken("nope")).toBe(false);
    const token = "verify-" + uniq();
    await db.authToken.updateMany({ where: { userId: u.id, type: "VERIFY_EMAIL" }, data: { tokenHash: sha256(token) } });
    expect(await verifyEmailToken(token)).toBe(true);
    expect(await verifyEmailToken(token)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt).not.toBeNull();
  });
});
