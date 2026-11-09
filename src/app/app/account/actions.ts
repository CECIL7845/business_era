"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/context";
import { requestMeta } from "@/lib/auth/session";
import { toActionError, type ActionState } from "@/lib/action";
import { changePassword, updateProfile } from "@/lib/services/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user } = await requireUser();
    await updateProfile(user.id, Object.fromEntries(fd));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return toActionError(e, fd);
  }
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, session } = await requireUser();
    const { ip } = await requestMeta();
    if (fd.get("newPassword") !== fd.get("confirm")) return { error: "The new passwords don't match.", fieldErrors: { confirm: "Doesn't match" } };
    await changePassword(user.id, String(fd.get("currentPassword") ?? ""), String(fd.get("newPassword") ?? ""), session.id, ip);
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function signOutEverywhereAction(): Promise<ActionState> {
  const { user, session } = await requireUser();
  const { ip } = await requestMeta();
  await db.session.deleteMany({ where: { userId: user.id, id: { not: session.id } } });
  await audit({ userId: user.id, action: "user.sign_out_everywhere", ip });
  redirect("/app/account?signedout=1");
}
