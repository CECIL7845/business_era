import Link from "next/link";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listPayments } from "@/lib/services/payments";
import { formatDate } from "@/lib/dates";
import { Badge, Card, EmptyState, LinkButton, Money, PageHeader, Pagination, SearchBar, cx, withParams } from "@/components/ui";

export const metadata = { title: "Payments" };
const METHODS = [["", "All"], ["CASH", "Cash"], ["MOMO", "MoMo"], ["BANK", "Bank"], ["CHEQUE", "Cheque"]] as const;

export default async function PaymentsPage({ searchParams }: PageProps<"/app/payments">) {
  const sp = await searchParams;
  const { ctx, membership } = await requireBusiness();
  const q = typeof sp.q === "string" ? sp.q : "";
  const method = typeof sp.method === "string" ? sp.method : "";
  const customerId = typeof sp.customerId === "string" ? sp.customerId : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listPayments(ctx, { q, method, customerId, page });
  return (
    <>
      <PageHeader title="Payments" subtitle="Collections from customers — cash, MoMo, bank and cheque." actions={can(membership.role, "payments.record") && <LinkButton href="/app/payments/new">Record payment</LinkButton>} />
      <Card>
        <SearchBar action="/app/payments" q={q} placeholder="Receipt no., MoMo reference or customer"><input type="hidden" name="method" value={method} /></SearchBar>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
          {METHODS.map(([k, label]) => (
            <Link key={k} href={withParams("/app/payments", { q, method: k, customerId })} className={cx("whitespace-nowrap rounded-full px-3 py-1 text-sm", method === k ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100")}>{label}</Link>
          ))}
          {customerId && <Link href={withParams("/app/payments", { q, method })} className="ml-auto whitespace-nowrap rounded-full bg-slate-800 px-3 py-1 text-sm text-white">One customer ✕</Link>}
        </div>
        {data.rows.length === 0 ? (
          <EmptyState title="No payments found" action={can(membership.role, "payments.record") && !q ? <LinkButton href="/app/payments/new">Record a payment</LinkButton> : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((p) => (
              <li key={p.id}>
                <Link href={`/app/payments/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.customer.name}</p>
                    <p className="truncate text-xs text-slate-500">{p.receiptNumber} · {formatDate(p.receivedAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <Money value={p.amount} className={p.status === "VOID" ? "text-slate-400 line-through" : "font-semibold text-emerald-700"} />
                    {p.status === "VOID" && <div><Badge>void</Badge></div>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={data.page} pageCount={data.pageCount} total={data.total} href={(pg) => withParams("/app/payments", { q, method, customerId, page: pg })} />
      </Card>
    </>
  );
}
