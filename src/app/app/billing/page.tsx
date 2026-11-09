import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { billingOverview } from "@/lib/services/billing";
import { paystackConfigured, paystackMode } from "@/lib/billing/paystack";
import { GRACE_DAYS } from "@/lib/billing/plans";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { cancelAction, checkoutAction } from "./actions";

export const metadata = { title: "Billing" };

const STATUS: Record<string, [string, "green" | "amber" | "red" | "blue" | "gray"]> = {
  TRIALING: ["Free trial", "blue"],
  ACTIVE: ["Active", "green"],
  PAST_DUE: ["Payment overdue (grace period)", "amber"],
  CANCELED: ["Cancelled — ends at period end", "amber"],
  EXPIRED: ["Expired — read-only", "red"],
  NONE: ["No subscription", "gray"],
};

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const sp = await searchParams;
  const { ctx, membership, entitlements: ent } = await requireBusiness();
  if (!can(membership.role, "billing.manage")) redirect("/app");
  const { sub, plans, history } = await billingOverview(ctx);
  const [label, tone] = STATUS[ent.status];
  const configured = paystackConfigured();

  return (
    <>
      <PageHeader title="Billing" subtitle="Pay with Mobile Money (MTN, Telecel, AT) or card via Paystack." />
      {sp.result === "success" && <div className="mb-4"><Alert tone="green" title="Payment confirmed">Thank you! Your subscription is active.</Alert></div>}
      {sp.result === "pending" && <div className="mb-4"><Alert tone="amber" title="Waiting for confirmation">We haven&apos;t received confirmation from the payment provider yet. If you approved the MoMo prompt, this page will update within a few minutes — you won&apos;t be charged twice.</Alert></div>}
      {sp.result === "failed" && <div className="mb-4"><Alert tone="red" title="Payment not completed">The payment was declined or cancelled. No money was taken. You can try again.</Alert></div>}
      {!configured && <div className="mb-4"><Alert tone="blue" title="Online payment not yet enabled">To subscribe now, pay by MoMo or bank transfer and contact support — your plan will be activated manually.</Alert></div>}
      {configured && paystackMode() === "test" && <div className="mb-4"><Alert tone="amber">Payments are in <strong>TEST mode</strong> — no real money is charged.</Alert></div>}

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Current plan</p>
            <p className="text-lg font-bold">{ent.plan?.name ?? "—"} <Badge tone={tone}>{label}</Badge></p>
            {ent.accessEndsAt && <p className="text-sm text-slate-600">{ent.status === "TRIALING" ? "Trial ends" : ent.status === "EXPIRED" ? "Ended" : "Paid until"} {formatDate(ent.accessEndsAt)}{ent.status === "PAST_DUE" ? ` · read-only after ${GRACE_DAYS}-day grace period` : ""}</p>}
          </div>
          {ent.status === "ACTIVE" && <ConfirmAction action={cancelAction} label="Cancel subscription" title="Cancel your subscription?" body={`You keep full access until ${ent.accessEndsAt ? formatDate(ent.accessEndsAt) : "the end of the period"}. After that the account becomes read-only; your data is kept and you can renew any time. There are no automatic charges either way.`} hidden={{ cancel: "1" }} confirmLabel="Cancel at period end" variant="secondary" />}
          {ent.status === "CANCELED" && <ActionForm action={cancelAction}><input type="hidden" name="cancel" value="0" /><SubmitButton variant="secondary">Keep my subscription</SubmitButton></ActionForm>}
        </div>
        <p className="mt-3 text-xs text-slate-500">Businestra never charges you automatically. Each period is paid when you choose; paying early adds time to your current period. Switching plans converts your unused paid days by value.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = sub?.planCode === p.code && (ent.status === "ACTIVE" || ent.status === "PAST_DUE" || ent.status === "CANCELED");
          return (
            <Card key={p.code} className={current ? "ring-2 ring-brand-600" : ""}>
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{p.name}</h2>{current && <Badge tone="green">Current</Badge>}</div>
                <p><span className="text-2xl font-bold">{formatCedis(p.priceMonthly)}</span><span className="text-sm text-slate-500"> / month</span></p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>✓ {p.maxUsers} user{p.maxUsers === 1 ? "" : "s"}</li>
                  <li>✓ {p.maxCustomers < 0 ? "Unlimited" : p.maxCustomers.toLocaleString("en-GH")} active customers</li>
                  <li>{p.canExport ? "✓ CSV exports for your accountant" : "✗ No CSV exports"}</li>
                </ul>
                {configured && (
                  <div className="space-y-2 pt-1">
                    <ActionForm action={checkoutAction}>
                      <input type="hidden" name="planCode" value={p.code} />
                      <input type="hidden" name="interval" value="MONTHLY" />
                      <SubmitButton className="w-full" pendingText="Opening checkout…">{current ? "Renew 1 month" : "Pay 1 month"} — {formatCedis(p.priceMonthly)}</SubmitButton>
                    </ActionForm>
                    <ActionForm action={checkoutAction}>
                      <input type="hidden" name="planCode" value={p.code} />
                      <input type="hidden" name="interval" value="ANNUAL" />
                      <SubmitButton variant="secondary" className="w-full" pendingText="Opening checkout…">12 months — {formatCedis(p.priceAnnual)}</SubmitButton>
                    </ActionForm>
                    <p className="text-center text-xs text-emerald-700">Annual saves {formatCedis(p.priceMonthly * 12 - p.priceAnnual)}</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Billing history & receipts" className="mt-5">
        {history.length === 0 ? <p className="p-4 text-sm text-slate-500">No payments yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Date</th><th>Plan</th><th>Amount</th><th>Status</th><th className="px-4">Receipt</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(h.paidAt ?? h.createdAt)}</td>
                    <td>{h.planCode} · {h.interval === "ANNUAL" ? "12 months" : "1 month"}</td>
                    <td className="tabular-nums">{formatCedis(h.amount)}</td>
                    <td><Badge tone={h.status === "SUCCESS" ? "green" : h.status === "PENDING" ? "amber" : "gray"}>{h.status.toLowerCase()}</Badge>{h.failureReason && <span className="ml-1 text-xs text-slate-500">{h.failureReason}</span>}</td>
                    <td className="px-4">{h.receiptNumber ? <a className="text-brand-700 underline" href={`/app/billing/receipt/${h.id}`}>{h.receiptNumber}</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
