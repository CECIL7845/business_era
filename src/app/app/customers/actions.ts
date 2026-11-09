"use server";

import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { createCustomer, updateCustomer } from "@/lib/services/customers";

export async function createCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const { ctx } = await requireBusiness();
    id = (await createCustomer(ctx, Object.fromEntries(fd))).id;
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect(`/app/customers/${id}?created=1`);
}

export async function updateCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  try {
    const { ctx } = await requireBusiness();
    await updateCustomer(ctx, id, Object.fromEntries(fd));
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect(`/app/customers/${id}`);
}
