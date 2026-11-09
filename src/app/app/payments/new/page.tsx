import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { customerOptions } from "@/lib/services/customers";
import { getCustomerBalance } from "@/lib/services/ledger";
import { toAccraDay } from "@/lib/dates";
import { formatCedis, toDecimalString } from "@/lib/money";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { recordPaymentAction } from "../actions";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({ searchParams }: PageProps<"/app/payments/new">) {
  const sp = await searchParams;
  const { ctx, membership } = await requireBusiness();
  if (!can(membership.role, "payments.record")) redirect("/app/payments");
  const customers = await customerOptions(ctx);
  const preselected = typeof sp.customerId === "string" ? customers.find((c) => c.id === sp.customerId) : undefined;
  const bal = preselected ? await getCustomerBalance(ctx.businessId, preselected.id) : null;
  const today = toAccraDay(new Date());
  return (
    <>
      <PageHeader title="Record payment" subtitle="Payments are applied to the customer's oldest unpaid invoices first." back={{ href: "/app/payments", label: "Payments" }} />
      <Card className="max-w-xl p-5">
        <ActionForm action={recordPaymentAction}>
          <Select name="customerId" label="Customer" defaultValue={preselected?.id ?? ""} options={[{ value: "", label: "— Choose customer —" }, ...customers.map((c) => ({ value: c.id, label: c.name + (c.location ? ` — ${c.location}` : "") }))]} />
          {bal && <p className="-mt-2 text-sm text-slate-600">Current balance: <strong>{formatCedis(bal.balance)}</strong>{bal.overdue > 0 && <> · <span className="text-red-700">{formatCedis(bal.overdue)} overdue</span></>}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="amount" label="Amount (GH₵)" inputMode="decimal" required defaultValue={bal && bal.overdue > 0 ? toDecimalString(bal.overdue) : undefined} />
            <Field name="receivedAt" label="Date received" type="date" defaultValue={today} max={today} required />
          </div>
          <Select name="method" label="Method" defaultValue="MOMO" options={[{ value: "MOMO", label: "Mobile Money" }, { value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank transfer / deposit" }, { value: "CHEQUE", label: "Cheque" }]} />
          <Field name="reference" label="Transaction ID / reference" hint="Required for MoMo and bank — prevents the same payment being recorded twice." />
          <TextArea name="notes" label="Notes (optional)" rows={2} />
          <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
