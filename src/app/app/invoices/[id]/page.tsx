import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getInvoice } from "@/lib/services/invoices";
import { isAppError } from "@/lib/errors";
import { daysOverdue, formatDate, formatDateTime } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { formatGhanaPhone, whatsappLink } from "@/lib/phone";
import { Alert, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmAction } from "@/components/form";
import { PrintButton } from "@/components/print-button";
import { InvoiceStatusBadge } from "../status-badge";
import { voidInvoiceAction } from "../actions";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: PageProps<"/app/invoices/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, business, membership } = await requireBusiness();
  const inv = await getInvoice(ctx, id).catch((e) => (isAppError(e) ? null : Promise.reject(e)));
  if (!inv) notFound();
  const outstanding = inv.status === "VOID" ? 0 : inv.total - inv.amountPaid;
  const late = daysOverdue(inv.dueDate);
  const share = `${business.name} — Invoice ${inv.number} for ${inv.customer.name}: ${inv.items.map((i) => `${i.quantity} × ${i.description}`).join("; ")}. Total ${formatCedis(inv.total)}, balance ${formatCedis(outstanding)}, due ${formatDate(inv.dueDate)}.`;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">Invoice {inv.number} <InvoiceStatusBadge status={inv.status} total={inv.total} paid={inv.amountPaid} late={late} /></span>}
        back={{ href: "/app/invoices", label: "Invoices" }}
        actions={
          <>
            {outstanding > 0 && can(membership.role, "payments.record") && <LinkButton href={`/app/payments/new?customerId=${inv.customerId}`}>Record payment</LinkButton>}
            <PrintButton />
            {inv.customer.phone && <a href={whatsappLink(inv.customer.phone, share)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>Share on WhatsApp</a>}
            {inv.status === "ISSUED" && can(membership.role, "invoices.void") && (
              <ConfirmAction action={voidInvoiceAction} label="Void" title={`Void invoice ${inv.number}?`} body="The invoice stays on record marked VOID, goods are returned to stock, and any payments are re-applied to this customer's other invoices (or kept as credit). This cannot be undone." confirmLabel="Void invoice" hidden={{ id: inv.id }} requireReason />
            )}
          </>
        }
      />
      {sp.created && <div className="mb-4 print:hidden"><Alert tone="green">Invoice saved.</Alert></div>}
      {inv.status === "VOID" && <div className="mb-4"><Alert tone="red" title="This invoice is void">Voided {inv.voidedAt ? formatDateTime(inv.voidedAt) : ""}. Reason: {inv.voidReason}</Alert></div>}

      <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8 print:p-0 print:shadow-none print:ring-0">
        <header className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold">{business.name}</p>
            <p className="text-sm text-slate-600">{[business.address, business.city].filter(Boolean).join(", ")}</p>
            <p className="text-sm text-slate-600">{[formatGhanaPhone(business.phone), business.email].filter(Boolean).join(" · ")}</p>
            {business.tin && <p className="text-sm text-slate-600">TIN: {business.tin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-slate-700">{inv.status === "VOID" ? "Void invoice" : "Invoice"}</p>
            <p className="text-sm"><span className="text-slate-500">No.</span> {inv.number}</p>
            <p className="text-sm"><span className="text-slate-500">Date</span> {formatDate(inv.issueDate)}</p>
            <p className="text-sm"><span className="text-slate-500">Due</span> {formatDate(inv.dueDate)}</p>
          </div>
        </header>
        <div className="mt-4 text-sm">
          <p className="text-slate-500">Bill to</p>
          <Link href={`/app/customers/${inv.customer.id}`} className="font-semibold hover:underline print:no-underline">{inv.customer.name}</Link>
          <p className="text-slate-600">{[inv.customer.contactName, formatGhanaPhone(inv.customer.phone), inv.customer.location].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500"><th className="py-2">Item</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {inv.items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100"><td className="py-2 pr-2">{i.description}</td><td className="text-right tabular-nums">{i.quantity}</td><td className="text-right tabular-nums">{formatCedis(i.unitPrice)}</td><td className="text-right tabular-nums">{formatCedis(i.lineTotal)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCedis(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">−{formatCedis(inv.discount)}</span></div>}
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold"><span>Total</span><span className="tabular-nums">{formatCedis(inv.total)}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="tabular-nums">{formatCedis(inv.status === "VOID" ? 0 : inv.amountPaid)}</span></div>
          <div className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular-nums">{formatCedis(outstanding)}</span></div>
        </div>
        {inv.notes && <p className="mt-5 whitespace-pre-wrap text-sm text-slate-600">{inv.notes}</p>}
        {inv.allocations.length > 0 && (
          <div className="mt-6 print:hidden">
            <p className="mb-1 text-sm font-semibold">Payments applied</p>
            <ul className="text-sm">
              {inv.allocations.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-slate-100 py-1.5">
                  <Link href={`/app/payments/${a.payment.id}`} className="text-brand-700 hover:underline">{a.payment.receiptNumber} · {formatDate(a.payment.receivedAt)} · {a.payment.method}</Link>
                  <span className="tabular-nums">{formatCedis(a.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-8 text-xs text-slate-500">This is a commercial invoice for goods supplied on credit. It is not a GRA VAT invoice.</p>
      </article>
    </>
  );
}
