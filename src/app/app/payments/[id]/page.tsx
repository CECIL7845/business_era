import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getPayment } from "@/lib/services/payments";
import { getCustomerBalance } from "@/lib/services/ledger";
import { isAppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { formatGhanaPhone, whatsappLink } from "@/lib/phone";
import { Alert, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmAction } from "@/components/form";
import { PrintButton } from "@/components/print-button";
import { voidPaymentAction } from "../actions";

export const metadata = { title: "Receipt" };
const METHOD: Record<string, string> = { CASH: "Cash", MOMO: "Mobile Money", BANK: "Bank", CHEQUE: "Cheque" };

export default async function PaymentPage({ params, searchParams }: PageProps<"/app/payments/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, business, membership } = await requireBusiness();
  const p = await getPayment(ctx, id).catch((e) => (isAppError(e) ? null : Promise.reject(e)));
  if (!p) notFound();
  const bal = await getCustomerBalance(ctx.businessId, p.customerId);
  const allocated = p.allocations.reduce((s, a) => s + a.amount, 0);
  const msg = `${business.name}: we received ${formatCedis(p.amount)} (${METHOD[p.method]}) from ${p.customer.name} on ${formatDate(p.receivedAt)}. Receipt ${p.receiptNumber}. Your balance is now ${formatCedis(bal.balance)}. Thank you!`;
  return (
    <>
      <PageHeader
        title={`Receipt ${p.receiptNumber}`}
        back={{ href: "/app/payments", label: "Payments" }}
        actions={
          <>
            <PrintButton />
            {p.customer.phone && p.status === "RECORDED" && <a href={whatsappLink(p.customer.phone, msg)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>Send receipt on WhatsApp</a>}
            {p.status === "RECORDED" && can(membership.role, "payments.void") && (
              <ConfirmAction action={voidPaymentAction} label="Void" title={`Void receipt ${p.receiptNumber}?`} body="Use this only if the payment was recorded by mistake or bounced. The amount will be added back to what the customer owes. This cannot be undone." confirmLabel="Void payment" hidden={{ id: p.id }} requireReason />
            )}
          </>
        }
      />
      {sp.created && <div className="mb-4 print:hidden"><Alert tone="green">Payment recorded. {p.customer.name}&apos;s balance is now {formatCedis(bal.balance)}.</Alert></div>}
      {p.status === "VOID" && <div className="mb-4"><Alert tone="red" title="This payment is void">Voided {p.voidedAt ? formatDateTime(p.voidedAt) : ""}. Reason: {p.voidReason}</Alert></div>}
      <article className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
        <div className="text-center">
          <p className="text-lg font-bold">{business.name}</p>
          <p className="text-sm text-slate-600">{[business.city, formatGhanaPhone(business.phone)].filter(Boolean).join(" · ")}</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">{p.status === "VOID" ? "Void receipt" : "Payment receipt"}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatCedis(p.amount)}</p>
        </div>
        <dl className="mt-5 space-y-1.5 text-sm">
          {[
            ["Receipt no.", p.receiptNumber],
            ["Date", formatDate(p.receivedAt)],
            ["Received from", p.customer.name],
            ["Method", METHOD[p.method]],
            ...(p.reference ? [["Reference", p.reference]] : []),
            ["Balance after payment", formatCedis(bal.balance)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-1.5"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        {p.allocations.length > 0 && (
          <div className="mt-4 text-sm">
            <p className="mb-1 font-semibold">Applied to</p>
            {p.allocations.map((a) => (
              <div key={a.id} className="flex justify-between py-0.5"><Link href={`/app/invoices/${a.invoice.id}`} className="text-brand-700 hover:underline print:no-underline print:text-slate-800">{a.invoice.number}</Link><span className="tabular-nums">{formatCedis(a.amount)}</span></div>
            ))}
            {p.status === "RECORDED" && allocated < p.amount && <div className="flex justify-between py-0.5 text-emerald-700"><span>Held as credit</span><span className="tabular-nums">{formatCedis(p.amount - allocated)}</span></div>}
          </div>
        )}
        {p.notes && <p className="mt-4 text-sm text-slate-600">{p.notes}</p>}
        <p className="mt-6 text-center text-xs text-slate-500">Thank you for your business.</p>
      </article>
    </>
  );
}
