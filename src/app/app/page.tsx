import Link from "next/link";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getDashboard } from "@/lib/services/reports";
import { formatDate, daysOverdue } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { Alert, Badge, Card, EmptyState, LinkButton, Money, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const { ctx, business, membership } = await requireBusiness();
  const d = await getDashboard(ctx);
  const isNew = d.customerCount === 0;
  const maxBucket = Math.max(1, ...Object.values(d.buckets));
  const bucketRows: [string, number, string][] = [
    ["Not yet due", d.buckets.current, "bg-emerald-500"],
    ["1–30 days late", d.buckets.d1_30, "bg-amber-400"],
    ["31–60 days late", d.buckets.d31_60, "bg-orange-500"],
    ["61–90 days late", d.buckets.d61_90, "bg-red-500"],
    ["Over 90 days late", d.buckets.d90, "bg-red-700"],
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={business.name}
        actions={
          <>
            {can(membership.role, "payments.record") && <LinkButton href="/app/payments/new" variant="secondary">Record payment</LinkButton>}
            {can(membership.role, "invoices.create") && <LinkButton href="/app/invoices/new">New invoice</LinkButton>}
          </>
        }
      />
      {sp.welcome && <div className="mb-4"><Alert tone="green" title="Your business is ready — 14-day free trial started">Follow the steps below to record your first credit sale.</Alert></div>}

      {isNew ? (
        <Card title="Get started in 3 steps">
          <ol className="divide-y divide-slate-100">
            {[
              { href: "/app/products/new", t: "Add the products you sell", b: "Name, unit (carton, bag…), price and opening stock. Skip stock tracking if you prefer." },
              { href: "/app/customers/new", t: "Add your retailers", b: "Shop name, phone (for WhatsApp reminders), credit limit and payment terms." },
              { href: "/app/invoices/new", t: "Record a credit sale", b: "Businestra checks the credit limit, reduces stock and starts tracking what is owed." },
            ].map((s, i) => (
              <li key={s.href} className="flex items-start gap-3 p-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{i + 1}</span>
                <div className="flex-1">
                  <Link href={s.href} className="font-semibold text-brand-800 hover:underline">{s.t}</Link>
                  <p className="text-sm text-slate-600">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Need help? See the <Link href="/app/help" className="text-brand-700 underline">getting started guide</Link> or message us from the Help page.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Owed to you" value={formatCedis(d.outstanding)} hint={`${d.openInvoices} unpaid invoice${d.openInvoices === 1 ? "" : "s"}`} />
            <Stat label="Overdue" value={formatCedis(d.overdue)} tone={d.overdue > 0 ? "red" : undefined} hint={d.outstanding ? `${Math.round((d.overdue / d.outstanding) * 100)}% of amount owed` : undefined} />
            <Stat label="Collected this month" value={formatCedis(d.collectedThisMonth)} tone="green" hint={`Today: ${formatCedis(d.collectedToday)}`} />
            <Stat label="Sales this month" value={formatCedis(d.salesThisMonth)} hint={`${d.invoicesThisMonth} invoice${d.invoicesThisMonth === 1 ? "" : "s"}`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Who to chase today" actions={<Link href="/app/customers?filter=overdue&sort=overdue" className="text-sm text-brand-700 hover:underline">All overdue →</Link>}>
              {d.topOverdue.length === 0 ? (
                <EmptyState title="Nobody is overdue 🎉" body="Customers appear here when an invoice passes its due date." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.topOverdue.map((c) => (
                    <li key={c.id}>
                      <Link href={`/app/customers/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.oldestDue ? `Oldest due ${formatDate(c.oldestDue)} · ${daysOverdue(c.oldestDue)} days late` : ""}</p>
                        </div>
                        <div className="text-right">
                          <Money value={c.overdue} className="font-semibold text-red-700" />
                          <p className="text-xs text-slate-500">of <Money value={c.balance} /></p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Debt by age">
              <div className="space-y-3 p-4">
                {bucketRows.map(([label, value, color]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{label}</span><Money value={value} className="font-medium" /></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="presentation"><div className={`h-full rounded-full ${color}`} style={{ width: `${(value / maxBucket) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Recent payments" actions={<Link href="/app/payments" className="text-sm text-brand-700 hover:underline">All payments →</Link>}>
              {d.recentPayments.length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.recentPayments.map((p) => (
                    <li key={p.id}>
                      <Link href={`/app/payments/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{p.customer.name}</p><p className="text-xs text-slate-500">{formatDate(p.receivedAt)} · {p.method}</p></div>
                        <Money value={p.amount} className="text-sm font-semibold text-emerald-700" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Low stock" actions={<Link href="/app/products?filter=low" className="text-sm text-brand-700 hover:underline">All products →</Link>}>
              {d.lowStock.length === 0 ? (
                <EmptyState title="Stock levels look fine" body="Products appear here when stock falls to their reorder level." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.lowStock.map((p) => (
                    <li key={p.id}>
                      <Link href={`/app/products/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <span className="truncate text-sm">{p.name}</span>
                        <Badge tone={p.stockQty === 0 ? "red" : "amber"}>{p.stockQty} {p.unit} left</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
