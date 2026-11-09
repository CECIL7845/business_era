"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation } from "@/lib/services/team";

export async function inviteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx, user } = await requireBusiness();
    await inviteMember(ctx, Object.fromEntries(fd), { name: user.name, emailVerified: !!user.emailVerifiedAt });
    revalidatePath("/app/team");
    return { ok: true, message: `Invitation sent to ${fd.get("email")}. It expires in 7 days.` };
  } catch (e) {
    return toActionError(e, fd);
  }
}

export async function changeRoleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    await changeMemberRole(ctx, String(fd.get("membershipId")), String(fd.get("role")));
    revalidatePath("/app/team");
    return { ok: true, message: "Role updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    await removeMember(ctx, String(fd.get("membershipId")));
    revalidatePath("/app/team");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeInviteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    await revokeInvitation(ctx, String(fd.get("invitationId")));
    revalidatePath("/app/team");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
