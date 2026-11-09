import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCustomer } from "@/lib/services/customers";
import { getCustomerBalance } from "@/lib/services/ledger";
import { listInvoices } from "@/lib/services/invoices";
import { listPayments } from "@/lib/services/payments";
import { isAppError } from "@/lib/errors";
import { daysOverdue, formatDate } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { formatGhanaPhone, whatsappLink } from "@/lib/phone";
import { db } from "@/lib/db";
import { Alert, Badge, Card, EmptyState, LinkButton, Money, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params, searchParams }: PageProps<"/app/customers/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, business, membership } = await requireBusiness();
  const c = await getCustomer(ctx, id).catch((e) => (isAppError(e) ? null : Promise.reject(e)));
  if (!c) notFound();
  const [bal, open, payments, oldest] = await Promise.all([
    getCustomerBalance(ctx.businessId, c.id),
    listInvoices(ctx, { customerId: c.id, status: "open", pageSize: 50 }),
    listPayments(ctx, { customerId: c.id, pageSize: 10 }),
    db.invoice.findFirst({ where: { businessId: ctx.businessId, customerId: c.id, status: "ISSUED", amountPaid: { lt: db.invoice.fields.total } }, orderBy: { dueDate: "asc" } }),
  ]);
  const role = membership.role;
  const available = c.creditLimit - Math.max(0, bal.balance);
  const reminder =
    `Hello ${c.contactName ?? c.name}, this is ${business.name}. ` +
    `Your current balance with us is ${formatCedis(bal.balance)}` +
    (bal.overdue > 0 ? `, of which ${formatCedis(bal.overdue)} is overdue${oldest ? ` (oldest invoice ${oldest.number} was due ${formatDate(oldest.dueDate)})` : ""}` : "") +
    `. Kindly arrange payment${business.phone ? ` by MoMo to ${formatGhanaPhone(business.phone)}` : ""} or cash. Thank you!`;

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={[c.contactName, formatGhanaPhone(c.phone), c.location].filter(Boolean).join(" · ")}
        back={{ href: "/app/customers", label: "Customers" }}
        actions={
          <>
            {can(role, "invoices.create") && c.isActive && <LinkButton href={`/app/invoices/new?customerId=${c.id}`}>New invoice</LinkButton>}
            {can(role, "payments.record") && <LinkButton variant="secondary" href={`/app/payments/new?customerId=${c.id}`}>Record payment</LinkButton>}
            <LinkButton variant="secondary" href={`/app/customers/${c.id}/statement`}>Statement</LinkButton>
            {can(role, "customers.manage") && <LinkButton variant="ghost" href={`/app/customers/${c.id}/edit`}>Edit</LinkButton>}
          </>
        }
      />
      {sp.created && <div className="mb-4"><Alert tone="green">Customer saved.{c.creditLimit === 0 && " Their credit limit is 0 (cash only) until a manager sets one."}</Alert></div>}
      {!c.isActive && <div className="mb-4"><Alert tone="amber">This customer is inactive. Edit them to reactivate.</Alert></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={bal.balance < 0 ? "In credit" : "Balance owed"} value={formatCedis(Math.abs(bal.balance))} tone={bal.balance < 0 ? "green" : undefined} />
        <Stat label="Overdue" value={formatCedis(bal.overdue)} tone={bal.overdue > 0 ? "red" : undefined} hint={oldest && bal.overdue > 0 ? `${daysOverdue(oldest.dueDate)} days on oldest` : undefined} />
        <Stat label="Credit limit" value={formatCedis(c.creditLimit)} hint={c.creditLimit === 0 ? "Cash only" : available >= 0 ? `${formatCedis(available)} available` : <span className="text-red-700">Over by {formatCedis(-available)}</span>} />
        <Stat label="Terms" value={`${c.paymentTermsDays} days`} hint={c.assignedTo ? `Rep: ${c.assignedTo.user.name}` : "No rep assigned"} />
      </div>

      {c.phone && bal.balance > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="flex-1 text-sm text-emerald-900">Send a polite payment reminder from your own WhatsApp. You&apos;ll see and can edit the message before sending.</p>
          <a href={whatsappLink(c.phone, reminder)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">WhatsApp reminder</a>
          <a href={`sms:${c.phone}?body=${encodeURIComponent(reminder)}`} className="text-sm text-emerald-800 underline">or SMS</a>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title={`Unpaid invoices (${open.total})`} actions={<Link href={`/app/invoices?q=${encodeURIComponent(c.name)}`} className="text-sm text-brand-700 hover:underline">All invoices →</Link>}>
          {open.rows.length === 0 ? (
            <EmptyState title="Nothing outstanding" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {open.rows.map((i) => {
                const late = daysOverdue(i.dueDate);
                return (
                  <li key={i.id}>
                    <Link href={`/app/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium">{i.number}</p>
                        <p className="text-xs text-slate-500">Due {formatDate(i.dueDate)} {late > 0 && <Badge tone="red">{late}d late</Badge>}</p>
                      </div>
                      <div className="text-right"><Money value={i.total - i.amountPaid} className="text-sm font-semibold" /><p className="text-xs text-slate-500">of <Money value={i.total} /></p></div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Recent payments" actions={<Link href={`/app/payments?customerId=${c.id}`} className="text-sm text-brand-700 hover:underline">All →</Link>}>
          {payments.rows.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/payments/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <div><p className="text-sm font-medium">{p.receiptNumber} {p.status === "VOID" && <Badge tone="gray">void</Badge>}</p><p className="text-xs text-slate-500">{formatDate(p.receivedAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</p></div>
                    <Money value={p.amount} className={p.status === "VOID" ? "text-sm text-slate-400 line-through" : "text-sm font-semibold text-emerald-700"} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {c.notes && <Card title="Notes" className="mt-5"><p className="whitespace-pre-wrap p-4 text-sm text-slate-700">{c.notes}</p></Card>}
    </>
  );
}
