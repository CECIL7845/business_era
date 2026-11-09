import Link from "next/link";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Badge, Card, EmptyState, LinkButton, Money, PageHeader, Pagination, SearchBar, cx, withParams } from "@/components/ui";

export const metadata = { title: "Products & stock" };

export default async function ProductsPage({ searchParams }: PageProps<"/app/products">) {
  const sp = await searchParams;
  const { ctx, membership } = await requireBusiness();
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const filter = sp.filter === "low" ? "low" : sp.filter === "inactive" ? "inactive" : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 30;
  const where: Prisma.ProductWhereInput = { businessId: ctx.businessId, isActive: filter !== "inactive" };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }];
  if (filter === "low") Object.assign(where, { trackStock: true, stockQty: { lte: db.product.fields.reorderLevel } });
  const [rows, total] = await Promise.all([db.product.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }), db.product.count({ where })]);
  return (
    <>
      <PageHeader title="Products & stock" actions={can(membership.role, "products.manage") && <LinkButton href="/app/products/new">Add product</LinkButton>} />
      <Card>
        <SearchBar action="/app/products" q={q} placeholder="Product name or code"><input type="hidden" name="filter" value={filter} /></SearchBar>
        <div className="flex gap-1 border-b border-slate-100 px-3 py-2">
          {[["all", "All"], ["low", "Low stock"], ["inactive", "Inactive"]].map(([k, l]) => (
            <Link key={k} href={withParams("/app/products", { q, filter: k })} className={cx("rounded-full px-3 py-1 text-sm", filter === k ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100")}>{l}</Link>
          ))}
        </div>
        {rows.length === 0 ? (
          <EmptyState title={q || filter !== "all" ? "No products match" : "No products yet"} body={!q && filter === "all" ? "Add what you sell so invoices fill in prices automatically and stock is tracked." : undefined} action={!q && filter === "all" && can(membership.role, "products.manage") ? <LinkButton href="/app/products/new">Add product</LinkButton> : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/app/products/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-slate-500"><Money value={p.unitPrice} /> per {p.unit}{p.sku ? ` · ${p.sku}` : ""}</p></div>
                  {p.trackStock ? <Badge tone={p.stockQty === 0 ? "red" : p.stockQty <= p.reorderLevel ? "amber" : "green"}>{p.stockQty} {p.unit}</Badge> : <Badge>not tracked</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} total={total} href={(pg) => withParams("/app/products", { q, filter, page: pg })} />
      </Card>
    </>
  );
}
