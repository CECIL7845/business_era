"use client";

import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/form";
import type { ActionState } from "@/lib/action";

type V = { id?: string; name?: string; sku?: string; unit?: string; unitPrice?: string; costPrice?: string; reorderLevel?: string; trackStock?: boolean; isActive?: boolean };

export function ProductForm({ action, values = {}, isNew }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; values?: V; isNew?: boolean }) {
  return (
    <ActionForm action={action}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field name="name" label="Product name" required defaultValue={values.name} placeholder="e.g. Vegetable oil 1L (carton of 12)" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="unit" label="Selling unit" defaultValue={values.unit ?? "carton"} hint="carton, bag, crate, bale, piece…" />
        <Field name="sku" label="Code / SKU (optional)" defaultValue={values.sku} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="unitPrice" label="Selling price per unit (GH₵)" inputMode="decimal" required defaultValue={values.unitPrice} />
        <Field name="costPrice" label="Cost price (optional)" inputMode="decimal" defaultValue={values.costPrice} hint="Private — used for margin later." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew && <Field name="openingStock" label="Opening stock (units)" type="number" inputMode="numeric" min={0} defaultValue="0" />}
        <Field name="reorderLevel" label="Low-stock alert at" type="number" inputMode="numeric" min={0} defaultValue={values.reorderLevel ?? "0"} />
      </div>
      <input type="hidden" name="trackStock" value="false" />
      <Checkbox name="trackStock" label="Track stock for this product" hint="Sales reduce stock and you can't sell more than you have." defaultChecked={values.trackStock ?? true} />
      {values.id && (
        <>
          <input type="hidden" name="isActive" value="false" />
          <Checkbox name="isActive" label="Active" hint="Inactive products can't be added to new invoices." defaultChecked={values.isActive ?? true} />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{isNew ? "Save product" : "Save changes"}</SubmitButton>
        {isNew && <AddAnother />}
      </div>
    </ActionForm>
  );
}

function AddAnother() {
  return (
    <button type="submit" name="another" value="1" className="rounded-lg px-4 py-2.5 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-600 hover:bg-brand-50">
      Save &amp; add another
    </button>
  );
}
