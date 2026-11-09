"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { adminExtendTrial, adminGrantAccess, adminSetFeedbackStatus, adminUpdatePlan } from "@/lib/services/admin";

async function admin() {
  const { user, ip } = await requirePlatformAdmin();
  return { userId: user.id, ip };
}

export async function grantAccessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await adminGrantAccess(await admin(), Object.fromEntries(fd));
    revalidatePath("/admin");
    return { ok: true, message: "Access granted." };
  } catch (e) {
    return toActionError(e, fd);
  }
}

export async function extendTrialAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await adminExtendTrial(await admin(), String(fd.get("businessId")), fd.get("days"));
    revalidatePath("/admin");
    return { ok: true, message: "Trial extended." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updatePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await adminUpdatePlan(await admin(), Object.fromEntries(fd));
    revalidatePath("/admin");
    return { ok: true, message: "Plan updated." };
  } catch (e) {
    return toActionError(e, fd);
  }
}

export async function feedbackStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await adminSetFeedbackStatus(await admin(), String(fd.get("id")), fd.get("status"));
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
