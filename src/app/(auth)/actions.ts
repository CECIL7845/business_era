"use server";

import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/lib/action";
import { createSession, destroyCurrentSession, getSession, requestMeta } from "@/lib/auth/session";
import { authenticate, registerUser, requestPasswordReset, resetPassword, sendVerificationEmail } from "@/lib/services/auth";
import { acceptInvitation } from "@/lib/services/team";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let next: string;
  try {
    const { ip } = await requestMeta();
    const user = await authenticate(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), ip);
    await createSession(user.id);
    next = safeNext(fd.get("next"));
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect(next);
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let next: string;
  try {
    if (fd.get("terms") !== "on") return { error: "Please accept the Terms and Privacy Policy to continue.", fieldErrors: { terms: "Required" }, values: Object.fromEntries([...fd.entries()].filter(([k]) => !/password/i.test(k)).map(([k, v]) => [k, String(v)])) };
    const { ip } = await requestMeta();
    const user = await registerUser(Object.fromEntries(fd), ip);
    await createSession(user.id);
    next = safeNext(fd.get("next"), "/onboarding");
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect(next);
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ip } = await requestMeta();
    await requestPasswordReset(String(fd.get("email") ?? ""), ip);
    return { ok: true, message: "If an account exists for that email, we've sent a reset link. It expires in 1 hour — check your spam folder too." };
  } catch (e) {
    return toActionError(e, fd);
  }
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ip } = await requestMeta();
    if (fd.get("password") !== fd.get("confirm")) return { error: "The two passwords don't match.", fieldErrors: { confirm: "Passwords don't match" } };
    await resetPassword(String(fd.get("token") ?? ""), String(fd.get("password") ?? ""), ip);
  } catch (e) {
    return toActionError(e);
  }
  redirect("/login?reset=1");
}

export async function resendVerificationAction(): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.emailVerifiedAt) return { ok: true, message: "Your email is already confirmed." };
  try {
    await enforceRateLimit(`verify-resend:${session.userId}`, 3, 3600);
    await sendVerificationEmail(session.user.id, session.user.email, session.user.name);
    return { ok: true, message: `Confirmation email sent to ${session.user.email}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function acceptInviteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    const { ip } = await requestMeta();
    const m = await acceptInvitation(session.user, String(fd.get("token") ?? ""), ip);
    await db.session.update({ where: { id: session.id }, data: { activeBusinessId: m.businessId } });
  } catch (e) {
    return toActionError(e);
  }
  redirect("/app");
}
