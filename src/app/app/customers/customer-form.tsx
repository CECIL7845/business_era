"use client";

import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea } from "@/components/form";
import type { ActionState } from "@/lib/action";

type Values = { id?: string; name?: string; contactName?: string; phone?: string; location?: string; creditLimit?: string; paymentTermsDays?: string; notes?: string; assignedToId?: string; isActive?: boolean };

export function CustomerForm({ action, values = {}, canSetLimit, members, submitLabel, defaultTerms }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; values?: Values; canSetLimit: boolean; members: { id: string; name: string }[]; submitLabel: string; defaultTerms: number }) {
  return (
    <ActionForm action={action}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field name="name" label="Shop / customer name" required defaultValue={values.name} placeholder="e.g. Auntie Ama Provisions" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="contactName" label="Contact person" defaultValue={values.contactName} />
        <Field name="phone" label="Phone (MoMo / WhatsApp)" type="tel" defaultValue={values.phone} placeholder="024 123 4567" />
      </div>
      <Field name="location" label="Location" defaultValue={values.location} placeholder="e.g. Madina Market, near the lorry station" />
      <div className="grid gap-4 sm:grid-cols-2">
        {canSetLimit ? (
          <Field name="creditLimit" label="Credit limit (GH₵)" inputMode="decimal" defaultValue={values.creditLimit ?? "0"} hint="Maximum this customer may owe. 0 = cash only." />
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Credit limit: {values.creditLimit ?? "0.00"} — set by a manager or owner.</p>
        )}
        <Field name="paymentTermsDays" label="Payment terms (days)" type="number" inputMode="numeric" min={0} max={365} defaultValue={values.paymentTermsDays ?? String(defaultTerms)} />
      </div>
      <Select name="assignedToId" label="Assigned sales rep / collector" defaultValue={values.assignedToId ?? ""} options={[{ value: "", label: "— Nobody —" }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
      <TextArea name="notes" label="Notes" defaultValue={values.notes} placeholder="Landmarks, preferred payment days, guarantor…" />
      {values.id && <input type="hidden" name="isActive" value="false" />}
      {values.id && <Checkbox name="isActive" label="Active customer" hint="Inactive customers are hidden from pickers and don't count towards your plan limit." defaultChecked={values.isActive ?? true} />}
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
