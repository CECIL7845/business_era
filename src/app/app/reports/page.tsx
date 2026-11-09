import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getDashboard, getPeriodSummary } from "@/lib/services/reports";
import { parseDay, startOfMonth, startOfToday, toAccraDay } from "@/lib/dates";
import { formatCedis } from "@/lib/money";
import { Alert, Card, Money, PageHeader, Stat, buttonClass } from "@/components/ui";

export const metadata = { title: "Reports" };
const METHOD: Record<string, string> = { CASH: "Cash", MOMO: "Mobile Money", BANK: "Bank", CHEQUE: "Cheque" };

export default async function ReportsPage({ searchParams }: PageProps<"/app/reports">) {
  const sp = await searchParams;
  const { ctx, membership, entitlements } = await requireBusiness();
  if (!can(membership.role, "reports.view")) redirect("/app");
  const from = parseDay(typeof sp.from === "string" ? sp.from : "") ?? startOfMonth();
  const to = parseDay(typeof sp.to === "string" ? sp.to : "") ?? startOfToday();
  const [s, d] = await Promise.all([getPeriodSummary(ctx, from, to), getDashboard(ctx)]);
  const range = `from=${toAccraDay(from)}&to=${toAccraDay(to)}`;
  const canExport = can(membership.role, "data.export") && (entitlements.canExport || (membership.role === "OWNER" && !entitlements.canWrite));
  const collectionRate = s.salesTotal > 0 ? Math.round((s.collectedTotal / s.salesTotal) * 100) : null;

  return (
    <>
      <PageHeader title="Reports" subtitle="Sales, collections and debt for any period." />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">From<input type="date" name="from" defaultValue={toAccraDay(from)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5" /></label>
        <label className="text-sm">To<input type="date" name="to" defaultValue={toAccraDay(to)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5" /></label>
        <button className={buttonClass("secondary", "sm")}>Apply</button>
      </form>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={formatCedis(s.salesTotal)} hint={`${s.invoiceCount} invoices · ${formatCedis(s.discounts)} discounts`} />
        <Stat label="Collected" value={formatCedis(s.collectedTotal)} tone="green" hint={collectionRate !== null ? `${collectionRate}% of sales in period` : undefined} />
        <Stat label="Owed now" value={formatCedis(d.outstanding)} />
        <Stat label="Overdue now" value={formatCedis(d.overdue)} tone={d.overdue ? "red" : undefined} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Collections by method">
          <table className="w-full text-sm"><tbody>
            {s.collections.length === 0 ? <tr><td className="p-4 text-slate-500">No payments in this period.</td></tr> : s.collections.map((c) => (
              <tr key={c.method} className="border-b border-slate-100"><td className="px-4 py-2">{METHOD[c.method]}</td><td className="text-slate-500">{c.count} payments</td><td className="px-4 text-right"><Money value={c.amount} className="font-medium" /></td></tr>
            ))}
          </tbody></table>
        </Card>
        <Card title="By staff member">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Name</th><th className="text-right">Sales</th><th className="px-4 text-right">Collected</th></tr></thead>
              <tbody>
                {s.staff.length === 0 ? <tr><td colSpan={3} className="p-4 text-slate-500">No activity in this period.</td></tr> : s.staff.map((m) => (
                  <tr key={m.name} className="border-t border-slate-100"><td className="px-4 py-2">{m.name}</td><td className="text-right"><Money value={m.sales} /> <span className="text-xs text-slate-500">({m.invoices})</span></td><td className="px-4 text-right"><Money value={m.collected} /> <span className="text-xs text-slate-500">({m.payments})</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card title="Download for your accountant (CSV / Excel)" className="mt-5">
        <div className="p-4">
          {!canExport ? (
            <Alert tone="blue">CSV export is included in the Growth and Distributor plans{membership.role === "OWNER" ? " — upgrade on the Billing page" : ""}.</Alert>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Plain <a>: these are file downloads from route handlers, not page navigations. */}
              {[
                ["/api/export/customers", "Customer balances"],
                ["/api/export/aging", "Debtors / aging list"],
                [`/api/export/invoices?${range}`, "Invoices in period"],
                [`/api/export/payments?${range}`, "Payments in period"],
              ].map(([href, label]) => (
                <a key={href} className={buttonClass("secondary", "sm")} href={href} download>
                  {label}
                </a>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">Exports are logged in the activity log.</p>
        </div>
      </Card>
    </>
  );
}
