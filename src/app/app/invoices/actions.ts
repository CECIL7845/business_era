"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { createInvoice, voidInvoice } from "@/lib/services/invoices";

export async function createInvoiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const { ctx } = await requireBusiness();
    id = (await createInvoice(ctx, Object.fromEntries(fd))).id;
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect(`/app/invoices/${id}?created=1`);
}

export async function voidInvoiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    const id = String(fd.get("id") ?? "");
    await voidInvoice(ctx, id, fd.get("reason"));
    revalidatePath(`/app/invoices/${id}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
