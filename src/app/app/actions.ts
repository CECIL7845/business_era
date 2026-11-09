"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { setActiveBusiness } from "@/lib/auth/session";
import { toActionError, type ActionState } from "@/lib/action";
import { submitFeedback } from "@/lib/services/feedback";

export async function switchBusinessAction(fd: FormData) {
  const { user, session } = await requireUser();
  const businessId = String(fd.get("businessId") ?? "");
  // Only switch to a business the user is actually a member of.
  const m = await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId } } });
  if (m) await setActiveBusiness(session.id, m.businessId);
  redirect("/app");
}

export async function feedbackAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, session } = await requireUser();
    await submitFeedback(Object.fromEntries(fd), { userId: user.id, businessId: session.activeBusinessId });
    return { ok: true, message: "Thank you! We read every message and will reply by email if needed." };
  } catch (e) {
    return toActionError(e, fd);
  }
}
