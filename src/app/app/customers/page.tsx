import Link from "next/link";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listCustomersWithBalances, type CustomerFilter, type CustomerSort } from "@/lib/services/ledger";
import { formatGhanaPhone } from "@/lib/phone";
import { Badge, Card, EmptyState, LinkButton, Money, PageHeader, Pagination, SearchBar, cx, withParams } from "@/components/ui";

export const metadata = { title: "Customers" };

const FILTERS: { key: CustomerFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "owing", label: "Owing" },
  { key: "overdue", label: "Overdue" },
  { key: "over_limit", label: "Over limit" },
  { key: "inactive", label: "Inactive" },
];

export default async function CustomersPage({ searchParams }: PageProps<"/app/customers">) {
  const sp = await searchParams;
  const { ctx, membership } = await requireBusiness();
  const q = typeof sp.q === "string" ? sp.q : "";
  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "all") as CustomerFilter;
  const sort = (["name", "balance", "overdue"].includes(String(sp.sort)) ? sp.sort : "name") as CustomerSort;
  const page = Math.max(1, Number(sp.page) || 1);
  const mine = sp.mine === "1";
  const data = await listCustomersWithBalances(ctx.businessId, { q, filter, sort, page, assignedToId: mine ? ctx.membershipId : undefined });
  const link = (p: Record<string, string | number | undefined>) => withParams("/app/customers", { q, filter, sort, mine: mine ? "1" : undefined, ...p });

  return (
    <>
      <PageHeader title="Customers" subtitle="Retailers you sell to, and what each one owes." actions={can(membership.role, "customers.manage") && <LinkButton href="/app/customers/new">Add customer</LinkButton>} />
      <Card>
        <SearchBar action="/app/customers" q={q} placeholder="Search name, phone or location">
          <input type="hidden" name="filter" value={filter} />
          <select name="sort" defaultValue={sort} aria-label="Sort" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="name">Sort: Name</option>
            <option value="balance">Sort: Highest balance</option>
            <option value="overdue">Sort: Most overdue</option>
          </select>
        </SearchBar>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
          {FILTERS.map((f) => (
            <Link key={f.key} href={link({ filter: f.key, page: undefined })} className={cx("whitespace-nowrap rounded-full px-3 py-1 text-sm", filter === f.key ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100")}>
              {f.label}
            </Link>
          ))}
          <Link href={withParams("/app/customers", { q, filter, sort, mine: mine ? undefined : "1" })} className={cx("ml-auto whitespace-nowrap rounded-full px-3 py-1 text-sm", mine ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}>
            Assigned to me
          </Link>
        </div>
        {data.rows.length === 0 ? (
          <EmptyState
            title={q || filter !== "all" || mine ? "No customers match" : "No customers yet"}
            body={q || filter !== "all" || mine ? "Try a different search or filter." : "Add the retailers you sell to on credit."}
            action={!q && filter === "all" && can(membership.role, "customers.manage") ? <LinkButton href="/app/customers/new">Add your first customer</LinkButton> : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.rows.map((c) => (
              <li key={c.id}>
                <Link href={`/app/customers/${c.id}`} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[2fr_1fr_1fr_1fr]">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-slate-500">{[formatGhanaPhone(c.phone), c.location, c.assignedName && `Rep: ${c.assignedName}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-right sm:order-none">
                    <Money value={c.balance} colorNegative className="font-semibold" />
                    <p className="text-xs text-slate-500 sm:hidden">{c.overdue > 0 ? <span className="text-red-700">{"Overdue "}<Money value={c.overdue} /></span> : "Balance"}</p>
                  </div>
                  <div className="hidden text-right sm:block">{c.overdue > 0 ? <Money value={c.overdue} className="font-medium text-red-700" /> : <span className="text-slate-400">—</span>}<p className="text-xs text-slate-500">overdue</p></div>
                  <div className="hidden text-right sm:block">
                    <Money value={c.creditLimit} className="text-slate-600" />
                    <p className="text-xs">{c.balance > c.creditLimit ? <Badge tone="red">over limit</Badge> : <span className="text-slate-500">limit</span>}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={data.page} pageCount={data.pageCount} total={data.total} href={(p) => link({ page: p })} />
      </Card>
    </>
  );
}
