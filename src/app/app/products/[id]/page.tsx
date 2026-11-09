import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getProduct } from "@/lib/services/products";
import { isAppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { toDecimalString } from "@/lib/money";
import { ActionForm, Field, Select, SubmitButton } from "@/components/form";
import { Badge, Card, EmptyState, Money, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import { adjustStockAction, updateProductAction } from "../actions";

export const metadata = { title: "Product" };
const REASON: Record<string, string> = { SALE: "Sale", RESTOCK: "Restock", ADJUSTMENT: "Adjustment", SALE_VOID: "Voided sale returned" };

export default async function ProductPage({ params }: PageProps<"/app/products/[id]">) {
  const { id } = await params;
  const { ctx, membership } = await requireBusiness();
  const p = await getProduct(ctx, id).catch((e) => (isAppError(e) ? null : Promise.reject(e)));
  if (!p) notFound();
  const movements = await db.stockMovement.findMany({ where: { businessId: ctx.businessId, productId: p.id }, orderBy: { createdAt: "desc" }, take: 30 });
  const users = await db.user.findMany({ where: { id: { in: [...new Set(movements.map((m) => m.createdById))] } }, select: { id: true, name: true } });
  const manage = can(membership.role, "products.manage");
  return (
    <>
      <PageHeader title={p.name} subtitle={<><Money value={p.unitPrice} /> per {p.unit}</>} back={{ href: "/app/products", label: "Products" }} actions={p.trackStock ? <Badge tone={p.stockQty <= p.reorderLevel ? "amber" : "green"}>{p.stockQty} {p.unit} in stock</Badge> : <Badge>Stock not tracked</Badge>} />
      <div className="grid gap-5 lg:grid-cols-2">
        {manage ? (
          <Card title="Details" className="p-0"><div className="p-5"><ProductForm action={updateProductAction} values={{ id: p.id, name: p.name, sku: p.sku ?? "", unit: p.unit, unitPrice: toDecimalString(p.unitPrice), costPrice: p.costPrice != null ? toDecimalString(p.costPrice) : "", reorderLevel: String(p.reorderLevel), trackStock: p.trackStock, isActive: p.isActive }} /></div></Card>
        ) : (
          <Card title="Details"><p className="p-4 text-sm text-slate-600">Only owners and managers can edit products.</p></Card>
        )}
        <div className="space-y-5">
          {p.trackStock && can(membership.role, "stock.adjust") && (
            <Card title="Update stock">
              <div className="p-5">
                <ActionForm action={adjustStockAction} resetOnSuccess>
                  <input type="hidden" name="id" value={p.id} />
                  <Select name="kind" label="Type" options={[{ value: "RESTOCK", label: "Restock (goods received)" }, { value: "ADJUSTMENT", label: "Adjustment (damage, count correction)" }]} />
                  <Field name="quantity" label={`Quantity (${p.unit})`} type="number" inputMode="numeric" required hint="For adjustments, use a negative number to reduce stock." />
                  <Field name="note" label="Note" hint="Supplier / waybill no., or reason for adjustment." />
                  <SubmitButton>Update stock</SubmitButton>
                </ActionForm>
              </div>
            </Card>
          )}
          <Card title="Stock history">
            {movements.length === 0 ? <EmptyState title="No stock movements yet" /> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {movements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div><p>{REASON[m.reason]}{m.note ? ` — ${m.note}` : ""}</p><p className="text-xs text-slate-500">{formatDateTime(m.createdAt)} · {users.find((u) => u.id === m.createdById)?.name ?? "—"}</p></div>
                    <span className={m.change > 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{m.change > 0 ? "+" : ""}{m.change}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
