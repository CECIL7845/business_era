"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/context";
import { toActionError, type ActionState } from "@/lib/action";
import { adjustStock, createProduct, updateProduct } from "@/lib/services/products";

export async function createProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const { ctx } = await requireBusiness();
    id = (await createProduct(ctx, Object.fromEntries(fd)))!.id;
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect(fd.get("another") === "1" ? "/app/products/new?added=1" : `/app/products/${id}`);
}

export async function updateProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    const id = String(fd.get("id") ?? "");
    await updateProduct(ctx, id, Object.fromEntries(fd));
    revalidatePath(`/app/products/${id}`);
    return { ok: true, message: "Product saved." };
  } catch (e) {
    return toActionError(e, fd);
  }
}

export async function adjustStockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { ctx } = await requireBusiness();
    const id = String(fd.get("id") ?? "");
    await adjustStock(ctx, id, Object.fromEntries(fd));
    revalidatePath(`/app/products/${id}`);
    return { ok: true, message: "Stock updated." };
  } catch (e) {
    return toActionError(e, fd);
  }
}
