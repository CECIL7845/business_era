"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { recordPayment, voidPayment } from "@/lib/services/payments";

export async function recordPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const { ctx } = await requireBusiness();
    id = (await recordPayment(ctx, Object.fromEntries(fd))).payment.id;
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect(`/app/payments/${id}?created=1`);
}

export async function voidPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    const id = String(fd.get("id") ?? "");
    await voidPayment(ctx, id, fd.get("reason"));
    revalidatePath(`/app/payments/${id}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
