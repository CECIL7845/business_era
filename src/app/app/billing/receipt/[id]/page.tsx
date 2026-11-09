import { notFound, redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Subscription receipt" };

export default async function SubscriptionReceiptPage({ params }: PageProps<"/app/billing/receipt/[id]">) {
  const { id } = await params;
  const { ctx, business, membership } = await requireBusiness();
  if (!can(membership.role, "billing.manage")) redirect("/app");
  const t = await db.billingTransaction.findFirst({ where: { id, businessId: ctx.businessId, status: "SUCCESS" } });
  if (!t) notFound();
  return (
    <>
      <PageHeader title={`Receipt ${t.receiptNumber}`} back={{ href: "/app/billing", label: "Billing" }} actions={<PrintButton />} />
      <article className="mx-auto max-w-md rounded-xl bg-white p-6 text-sm shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
        <p className="text-lg font-bold">Businestra</p>
        <p className="text-slate-500">Subscription payment receipt</p>
        <dl className="mt-4 space-y-1.5">
          {[["Receipt", t.receiptNumber], ["Billed to", business.name], ["Date paid", formatDateTime(t.paidAt ?? t.createdAt)], ["Plan", `${t.planCode} · ${t.interval === "ANNUAL" ? "12 months" : "1 month"}`], ["Paid via", `Paystack${t.channel ? ` (${t.channel.replace("_", " ")})` : ""}`], ["Payment reference", t.reference], ["Amount", formatCedis(t.amount)]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-1.5"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-slate-500">This is a payment receipt, not a VAT invoice.</p>
      </article>
    </>
  );
}
