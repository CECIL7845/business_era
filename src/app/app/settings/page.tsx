import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatGhanaPhone } from "@/lib/phone";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { updateSettingsAction } from "./actions";

export const metadata = { title: "Business settings" };

export default async function SettingsPage() {
  const { business: b, membership } = await requireBusiness();
  if (!can(membership.role, "settings.manage")) redirect("/app");
  return (
    <>
      <PageHeader title="Business settings" subtitle="Shown on invoices, receipts and statements." />
      <Card className="max-w-2xl p-5">
        <ActionForm action={updateSettingsAction}>
          <Field name="name" label="Business name" required defaultValue={b.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="phone" label="Phone (MoMo number for payments)" type="tel" defaultValue={formatGhanaPhone(b.phone)} />
            <Field name="email" label="Email" type="email" defaultValue={b.email ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="address" label="Address / digital address" defaultValue={b.address ?? ""} placeholder="e.g. GA-123-4567" />
            <Field name="city" label="Town / city" defaultValue={b.city ?? ""} />
          </div>
          <Field name="tin" label="GRA TIN (optional)" defaultValue={b.tin ?? ""} hint="Printed on documents. Businestra documents are commercial invoices, not GRA E-VAT invoices." />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="invoicePrefix" label="Invoice prefix" defaultValue={b.invoicePrefix} hint={`Next: ${b.invoicePrefix}-${String(b.nextInvoiceNumber).padStart(5, "0")}`} />
            <Field name="receiptPrefix" label="Receipt prefix" defaultValue={b.receiptPrefix} />
            <Field name="defaultCreditDays" label="Default credit days" type="number" min={0} max={365} defaultValue={String(b.defaultCreditDays)} />
          </div>
          <SubmitButton>Save settings</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
