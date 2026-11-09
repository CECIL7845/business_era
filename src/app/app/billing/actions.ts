"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { setCancelAtPeriodEnd, startCheckout } from "@/lib/services/billing";

export async function checkoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let url: string;
  try {
    const { ctx, user, business } = await requireBusiness();
    // Paystack requires an email for the payer; use the owner's account email.
    url = await startCheckout(ctx, Object.fromEntries(fd), business.email ?? user.email);
  } catch (e) {
    return toActionError(e);
  }
  redirect(url);
}

export async function cancelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    await setCancelAtPeriodEnd(ctx, fd.get("cancel") === "1");
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
