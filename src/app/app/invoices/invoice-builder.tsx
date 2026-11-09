"use client";

import { useMemo, useState } from "react";
import { ActionForm, Checkbox, Field, Select, SubmitButton, TextArea, useFormState } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { formatCedis, parseCedis } from "@/lib/money";
import type { ActionState } from "@/lib/action";

type Customer = { id: string; name: string; location: string | null; creditLimit: number; paymentTermsDays: number };
type Product = { id: string; name: string; unit: string; unitPrice: number; stockQty: number; trackStock: boolean };
type Line = { key: number; productId: string; description: string; quantity: string; unitPrice: string };

let k = 1;
const blank = (): Line => ({ key: k++, productId: "", description: "", quantity: "1", unitPrice: "" });
const cedis = (p: number) => (p / 100).toFixed(2);

export function InvoiceBuilder(props: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  customers: Customer[];
  products: Product[];
  canSetPrice: boolean;
  canOverride: boolean;
  defaultCustomerId?: string;
  today: string;
}) {
  return (
    <ActionForm action={props.action}>
      <Inner {...props} />
    </ActionForm>
  );
}

function Inner({ customers, products, canSetPrice, canOverride, defaultCustomerId, today }: Parameters<typeof InvoiceBuilder>[0]) {
  const state = useFormState();
  const [customerId, setCustomerId] = useState(state.values?.customerId ?? defaultCustomerId ?? "");
  const [lines, setLines] = useState<Line[]>(() => {
    try {
      const saved = state.values?.items ? (JSON.parse(state.values.items) as Omit<Line, "key">[]) : null;
      if (saved?.length) return saved.map((l) => ({ ...l, key: k++, quantity: String(l.quantity), unitPrice: String(l.unitPrice) }));
    } catch {}
    return [blank()];
  });
  const [discount, setDiscount] = useState(state.values?.discount ?? "");
  const [paidNow, setPaidNow] = useState(state.values?.paidNowAmount ?? "");
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const customer = customers.find((c) => c.id === customerId);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const lineTotal = (l: Line) => (parseCedis(l.unitPrice) ?? 0) * (Number.parseInt(l.quantity) || 0);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const total = subtotal - (parseCedis(discount) ?? 0);
  const items = lines.filter((l) => l.productId || l.description).map(({ productId, description, quantity, unitPrice }) => ({ productId, description, quantity, unitPrice }));

  return (
    <>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="customerId" className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
          <select id="customerId" name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm">
            <option value="">— Choose customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ""}</option>)}
          </select>
          {customer && <p className="mt-1 text-xs text-slate-500">Credit limit {formatCedis(customer.creditLimit)} · {customer.paymentTermsDays}-day terms</p>}
          {state.fieldErrors?.customerId && <p className="mt-1 text-sm text-red-700">Choose a customer</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="issueDate" label="Invoice date" type="date" defaultValue={today} max={today} required />
          <Field name="dueDate" label="Due date" type="date" hint={customer ? `Default: +${customer.paymentTermsDays} days` : "Default: customer terms"} />
        </div>
      </div>

      <div className="rounded-xl ring-1 ring-slate-200">
        <div className="hidden grid-cols-[1fr_6rem_8rem_8rem_2.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500 sm:grid">
          <span>Item</span><span>Qty</span><span>Unit price (GH₵)</span><span className="text-right">Amount</span><span />
        </div>
        <ul className="divide-y divide-slate-100">
          {lines.map((l, idx) => {
            const p = l.productId ? byId.get(l.productId) : undefined;
            const lowStock = p?.trackStock && (Number.parseInt(l.quantity) || 0) > p.stockQty;
            return (
              <li key={l.key} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-[1fr_6rem_8rem_8rem_2.5rem] sm:items-start">
                <div className="col-span-2 sm:col-span-1">
                  <label className="sr-only" htmlFor={`p-${l.key}`}>Product for line {idx + 1}</label>
                  <select
                    id={`p-${l.key}`}
                    value={l.productId}
                    onChange={(e) => {
                      const np = byId.get(e.target.value);
                      update(l.key, { productId: e.target.value, unitPrice: np ? cedis(np.unitPrice) : l.unitPrice, description: np ? "" : l.description });
                    }}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-base sm:text-sm"
                  >
                    <option value="">{canSetPrice ? "— Custom item —" : "— Choose product —"}</option>
                    {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}{pr.trackStock ? ` (${pr.stockQty} ${pr.unit})` : ""}</option>)}
                  </select>
                  {!l.productId && canSetPrice && (
                    <input aria-label={`Description for line ${idx + 1}`} placeholder="Description" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-base sm:text-sm" />
                  )}
                  {lowStock && <p className="mt-1 text-xs text-red-700">Only {p!.stockQty} {p!.unit} in stock</p>}
                </div>
                <input aria-label={`Quantity for line ${idx + 1}`} type="number" inputMode="numeric" min={1} value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-2 text-base sm:text-sm" />
                <input aria-label={`Unit price for line ${idx + 1}`} inputMode="decimal" value={l.unitPrice} readOnly={!canSetPrice && !!l.productId} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-2 text-base read-only:bg-slate-50 sm:text-sm" />
                <p className="self-center text-right text-sm font-medium tabular-nums">{formatCedis(lineTotal(l))}</p>
                <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank()]))} className="self-center justify-self-end rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove line ${idx + 1}`}>✕</button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-slate-200 p-3">
          <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className={buttonClass("secondary", "sm")}>+ Add line</button>
        </div>
      </div>
      {state.fieldErrors?.items && <p className="text-sm text-red-700">{state.fieldErrors.items}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <TextArea name="notes" label="Notes on invoice (optional)" rows={2} />
          <details className="rounded-lg bg-slate-50 p-3 text-sm" open={!!paidNow}>
            <summary className="cursor-pointer font-medium">Customer paid something now?</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="paidNowAmount" className="mb-1 block text-sm font-medium">Amount paid now (GH₵)</label>
                <input id="paidNowAmount" name="paidNowAmount" inputMode="decimal" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm" />
                {total > 0 && <button type="button" className="mt-1 text-xs text-brand-700 underline" onClick={() => setPaidNow(cedis(total))}>Paid in full</button>}
              </div>
              <Select name="paidNowMethod" label="Method" defaultValue="" options={[{ value: "", label: "—" }, { value: "CASH", label: "Cash" }, { value: "MOMO", label: "Mobile Money" }, { value: "BANK", label: "Bank" }, { value: "CHEQUE", label: "Cheque" }]} />
              <Field name="paidNowReference" label="MoMo / bank reference" />
            </div>
          </details>
        </div>
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCedis(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="discount">Discount (GH₵)</label>
            <input id="discount" name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-base sm:text-sm" />
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span className="tabular-nums">{formatCedis(Math.max(0, total))}</span></div>
          {paidNow && <div className="flex justify-between text-emerald-700"><span>Paid now</span><span className="tabular-nums">−{formatCedis(parseCedis(paidNow) ?? 0)}</span></div>}
        </div>
      </div>

      {canOverride && state.code === "CREDIT_LIMIT" && <Checkbox name="overrideCreditLimit" label="Override credit limit for this sale" hint="Recorded in the activity log with your name." />}
      <SubmitButton pendingText="Saving invoice…">Save invoice</SubmitButton>
    </>
  );
}
