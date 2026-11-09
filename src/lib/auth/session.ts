import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

const SECURE = process.env.NODE_ENV === "production";
// __Host- prefix forces Secure, Path=/ and no Domain — browsers reject it over plain http.
export const SESSION_COOKIE = SECURE ? "__Host-bz_session" : "bz_session";
const SESSION_DAYS = 30;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export async function requestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function createSession(userId: string, activeBusinessId?: string | null) {
  const token = randomToken(32);
  const { ip, userAgent } = await requestMeta();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { id: sha256(token), userId, activeBusinessId: activeBusinessId ?? null, expiresAt, ip, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: SECURE, sameSite: "lax", path: "/", expires: expiresAt });
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Rolling expiry: active users stay signed in; idle sessions expire after 30 days.
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) } }).catch(() => {});
  }
  return session;
});

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function setActiveBusiness(sessionId: string, businessId: string) {
  await db.session.update({ where: { id: sessionId }, data: { activeBusinessId: businessId } });
}
