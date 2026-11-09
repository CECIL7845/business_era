import Link from "next/link";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listInvoices, type InvoiceStatusFilter } from "@/lib/services/invoices";
import { daysOverdue, formatDate } from "@/lib/dates";
import { Card, EmptyState, LinkButton, Money, PageHeader, Pagination, SearchBar, cx, withParams } from "@/components/ui";
import { InvoiceStatusBadge } from "./status-badge";

export const metadata = { title: "Invoices" };

const TABS: { key: InvoiceStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
];

export default async function InvoicesPage({ searchParams }: PageProps<"/app/invoices">) {
  const sp = await searchParams;
  const { ctx, membership } = await requireBusiness();
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "all") as InvoiceStatusFilter;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listInvoices(ctx, { q, status, page });
  return (
    <>
      <PageHeader title="Invoices" subtitle="Every credit and cash sale." actions={can(membership.role, "invoices.create") && <LinkButton href="/app/invoices/new">New invoice</LinkButton>} />
      <Card>
        <SearchBar action="/app/invoices" q={q} placeholder="Invoice number or customer"><input type="hidden" name="status" value={status} /></SearchBar>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
          {TABS.map((t) => (
            <Link key={t.key} href={withParams("/app/invoices", { q, status: t.key })} className={cx("whitespace-nowrap rounded-full px-3 py-1 text-sm", status === t.key ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100")}>{t.label}</Link>
          ))}
        </div>
        {data.rows.length === 0 ? (
          <EmptyState title={q || status !== "all" ? "No invoices match" : "No invoices yet"} action={!q && status === "all" && can(membership.role, "invoices.create") ? <LinkButton href="/app/invoices/new">Create your first invoice</LinkButton> : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((i) => (
              <li key={i.id}>
                <Link href={`/app/invoices/${i.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[8rem_1fr_8rem_8rem_7rem]">
                  <span className="font-medium sm:order-none">{i.number}</span>
                  <span className="order-3 col-span-2 truncate text-sm text-slate-600 sm:order-none sm:col-span-1">{i.customer.name} · {formatDate(i.issueDate)}</span>
                  <Money value={i.total} className="text-right font-semibold" />
                  <span className="hidden text-right text-sm text-slate-600 sm:block">{i.status === "ISSUED" && i.total > i.amountPaid ? <>Due <Money value={i.total - i.amountPaid} /></> : "—"}</span>
                  <span className="order-4 text-right sm:order-none"><InvoiceStatusBadge status={i.status} total={i.total} paid={i.amountPaid} late={daysOverdue(i.dueDate)} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={data.page} pageCount={data.pageCount} total={data.total} href={(p) => withParams("/app/invoices", { q, status, page: p })} />
      </Card>
    </>
  );
}
