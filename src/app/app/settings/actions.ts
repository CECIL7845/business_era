"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { updateBusinessSettings } from "@/lib/services/business";

export async function updateSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    await updateBusinessSettings(ctx, Object.fromEntries(fd));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return toActionError(e, fd);
  }
}
