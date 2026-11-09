import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { getStatement } from "@/lib/services/reports";
import { isAppError } from "@/lib/errors";
import { addDays, formatDate, parseDay, startOfToday, toAccraDay } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { formatGhanaPhone, whatsappLink } from "@/lib/phone";
import { Money, PageHeader, buttonClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Customer statement" };

export default async function StatementPage({ params, searchParams }: PageProps<"/app/customers/[id]/statement">) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, business } = await requireBusiness();
  const to = parseDay(typeof sp.to === "string" ? sp.to : "") ?? startOfToday();
  const from = parseDay(typeof sp.from === "string" ? sp.from : "") ?? addDays(to, -90);
  const st = await getStatement(ctx, id, from, to).catch((e) => (isAppError(e) ? null : Promise.reject(e)));
  if (!st) notFound();
  const c = st.customer;
  const summary = `${business.name} — statement for ${c.name} (${formatDate(from)} to ${formatDate(to)}). Opening balance ${formatCedis(st.opening)}, closing balance ${formatCedis(st.closing)}. Unpaid invoices: ${st.openInvoices.map((i) => `${i.number} ${formatCedis(i.outstanding)}${i.daysOverdue ? ` (${i.daysOverdue}d late)` : ""}`).join(", ") || "none"}.`;

  return (
    <>
      <PageHeader
        title="Statement"
        back={{ href: `/app/customers/${c.id}`, label: c.name }}
        actions={
          <>
            <PrintButton />
            {c.phone && <a href={whatsappLink(c.phone, summary)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>Send summary on WhatsApp</a>}
          </>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm">From<input type="date" name="from" defaultValue={toAccraDay(from)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-sm">To<input type="date" name="to" defaultValue={toAccraDay(to)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5" /></label>
        <button className={buttonClass("secondary", "sm")}>Update</button>
      </form>

      <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8 print:p-0 print:shadow-none print:ring-0">
        <header className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold">{business.name}</p>
            <p className="text-sm text-slate-600">{[business.address, business.city].filter(Boolean).join(", ")}</p>
            <p className="text-sm text-slate-600">{[formatGhanaPhone(business.phone), business.email].filter(Boolean).join(" · ")}</p>
            {business.tin && <p className="text-sm text-slate-600">TIN: {business.tin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-slate-700">Statement</p>
            <p className="text-sm text-slate-600">{formatDate(from)} – {formatDate(to)}</p>
          </div>
        </header>
        <div className="mt-4 text-sm">
          <p className="text-slate-500">Customer</p>
          <p className="font-semibold">{c.name}</p>
          <p className="text-slate-600">{[c.contactName, formatGhanaPhone(c.phone), c.location].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500"><th className="py-2">Date</th><th>Reference</th><th>Details</th><th className="text-right">Charges</th><th className="text-right">Payments</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              <tr className="border-b border-slate-100"><td className="py-2" colSpan={5}>Opening balance</td><td className="text-right font-medium tabular-nums">{formatCedis(st.opening)}</td></tr>
              {st.lines.map((l) => (
                <tr key={`${l.kind}-${l.id}`} className="border-b border-slate-100">
                  <td className="py-2 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="whitespace-nowrap">{l.ref}</td>
                  <td className="text-slate-600">{l.kind === "invoice" ? `Invoice · ${l.detail}` : `Payment · ${l.detail}`}</td>
                  <td className="text-right tabular-nums">{l.debit ? formatCedis(l.debit) : ""}</td>
                  <td className="text-right tabular-nums text-emerald-700">{l.credit ? formatCedis(l.credit) : ""}</td>
                  <td className="text-right tabular-nums">{formatCedis(l.balance)}</td>
                </tr>
              ))}
              <tr><td className="py-3 font-semibold" colSpan={5}>Closing balance</td><td className="text-right text-base font-bold tabular-nums">{formatCedis(st.closing)}</td></tr>
            </tbody>
          </table>
        </div>
        {st.openInvoices.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">Unpaid invoices (all dates)</p>
            <table className="w-full text-sm">
              <tbody>
                {st.openInvoices.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="py-1.5">{i.number}</td>
                    <td>Due {formatDate(i.dueDate)}</td>
                    <td className={i.daysOverdue ? "text-red-700" : "text-slate-500"}>{i.daysOverdue ? `${i.daysOverdue} days overdue` : "Not yet due"}</td>
                    <td className="text-right"><Money value={i.outstanding} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-8 text-xs text-slate-500">Please contact {business.name} if anything on this statement looks wrong. Generated {formatDate(new Date())}.</p>
      </article>
    </>
  );
}
