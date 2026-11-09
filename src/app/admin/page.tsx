import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { effectiveStatus } from "@/lib/billing/subscription";
import { listBusinesses, platformMetrics } from "@/lib/services/admin";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatCedis, toDecimalString } from "@/lib/money";
import { ActionForm, Field, Select, SubmitButton } from "@/components/form";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { extendTrialAction, feedbackStatusAction, grantAccessAction, updatePlanAction } from "./actions";

export const metadata = { title: "Platform admin" };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [m, businesses, plans, feedback] = await Promise.all([
    platformMetrics(),
    listBusinesses(q),
    db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    db.feedback.findMany({ where: { status: { not: "RESOLVED" } }, orderBy: { createdAt: "desc" }, take: 50, include: { business: { select: { name: true } } } }),
  ]);
  const feedbackUsers = await db.user.findMany({ where: { id: { in: feedback.map((f) => f.userId).filter(Boolean) as string[] } }, select: { id: true, email: true } });
  const planOptions = plans.map((p) => ({ value: p.code, label: p.name }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader title="Platform admin" subtitle="Real businesses only (demo businesses excluded from metrics)." actions={<Link href="/app" className="text-sm text-brand-700 underline">Back to app</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR (paying)" value={formatCedis(m.mrr)} hint={`Collected last 30d: ${formatCedis(m.revenue30)}`} />
        <Stat label="Businesses" value={m.businesses} hint={Object.entries(m.byStatus).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ")} />
        <Stat label="Active last 7 days" value={m.activeBusinesses7} hint={`${m.invoices7} invoices · ${m.payments7} payments`} />
        <Stat label="New signups (7d)" value={m.signups7} hint={`${m.feedbackNew} new feedback`} />
      </div>

      <Card title="Businesses" className="mt-5">
        <form method="get" className="border-b border-slate-100 p-3"><input name="q" defaultValue={q} placeholder="Search business name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Business</th><th>Plan / status</th><th>Ends</th><th>Usage</th><th className="px-3">Support actions</th></tr></thead>
            <tbody>
              {businesses.map((b) => {
                const st = effectiveStatus(b.subscription);
                const end = b.subscription?.status === "TRIALING" ? b.subscription.trialEndsAt : b.subscription?.currentPeriodEnd;
                return (
                  <tr key={b.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2"><p className="font-medium">{b.name} {b.isDemo && <Badge>demo</Badge>}</p><p className="text-xs text-slate-500">since {formatDate(b.createdAt)} · {b.city ?? ""}</p></td>
                    <td>{b.subscription?.plan.name ?? "—"} <Badge tone={st === "ACTIVE" ? "green" : st === "TRIALING" ? "blue" : st === "EXPIRED" ? "red" : "amber"}>{st.toLowerCase()}</Badge></td>
                    <td className="whitespace-nowrap">{end ? formatDate(end) : "—"}</td>
                    <td className="text-xs text-slate-600">{b._count.memberships} users · {b._count.customers} customers · {b._count.invoices} invoices</td>
                    <td className="px-3 py-2">
                      <details>
                        <summary className="cursor-pointer text-brand-700">Manage</summary>
                        <div className="mt-2 w-72 space-y-4">
                          <ActionForm action={grantAccessAction}>
                            <input type="hidden" name="businessId" value={b.id} />
                            <Select name="planCode" label="Activate plan (offline payment)" options={planOptions} defaultValue={b.subscription?.planCode} />
                            <Field name="days" label="Days" type="number" defaultValue="30" />
                            <Field name="note" label="Note (payment reference)" required />
                            <SubmitButton variant="secondary">Grant access</SubmitButton>
                          </ActionForm>
                          {b.subscription?.status === "TRIALING" && (
                            <ActionForm action={extendTrialAction}>
                              <input type="hidden" name="businessId" value={b.id} />
                              <Field name="days" label="Extend trial by (days)" type="number" defaultValue="7" />
                              <SubmitButton variant="secondary">Extend trial</SubmitButton>
                            </ActionForm>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Plans & prices (changes apply to new payments)">
          <div className="space-y-5 p-4">
            {plans.map((p) => (
              <ActionForm key={p.code} action={updatePlanAction} className="rounded-lg bg-slate-50 p-3">
                <input type="hidden" name="code" value={p.code} />
                <p className="font-semibold">{p.name} ({p.code})</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field name="priceMonthly" label="Monthly GH₵" defaultValue={toDecimalString(p.priceMonthly)} />
                  <Field name="priceAnnual" label="Annual GH₵" defaultValue={toDecimalString(p.priceAnnual)} />
                  <Field name="maxUsers" label="Max users" type="number" defaultValue={String(p.maxUsers)} />
                  <Field name="maxCustomers" label="Max customers (-1 = ∞)" type="number" defaultValue={String(p.maxCustomers)} />
                </div>
                <SubmitButton variant="secondary">Save {p.name}</SubmitButton>
              </ActionForm>
            ))}
          </div>
        </Card>
        <Card title="Open feedback">
          {feedback.length === 0 ? <p className="p-4 text-sm text-slate-500">Nothing open.</p> : (
            <ul className="divide-y divide-slate-100">
              {feedback.map((f) => (
                <li key={f.id} className="space-y-1 p-4 text-sm">
                  <p><Badge tone={f.category === "bug" ? "red" : "blue"}>{f.category}</Badge> <span className="text-xs text-slate-500">{formatDateTime(f.createdAt)} · {f.business?.name ?? "—"} · {feedbackUsers.find((u) => u.id === f.userId)?.email}</span></p>
                  <p className="whitespace-pre-wrap">{f.message}</p>
                  <ActionForm action={feedbackStatusAction} className="flex items-end gap-2 space-y-0">
                    <input type="hidden" name="id" value={f.id} />
                    <select name="status" defaultValue={f.status} className="rounded border border-slate-300 px-2 py-1 text-xs"><option value="NEW">New</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select>
                    <SubmitButton variant="ghost" className="!px-2 !py-1 text-xs">Update</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
