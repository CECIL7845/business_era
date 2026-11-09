import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { Card, PageHeader, Pagination, withParams } from "@/components/ui";

export const metadata = { title: "Activity log" };

const LABELS: Record<string, string> = {
  "invoice.create": "Created invoice",
  "invoice.create_credit_override": "Created invoice ABOVE credit limit",
  "invoice.void": "Voided invoice",
  "payment.record": "Recorded payment",
  "payment.void": "Voided payment",
  "customer.create": "Added customer",
  "customer.update": "Edited customer",
  "customer.credit_limit_change": "Changed credit limit",
  "product.create": "Added product",
  "product.update": "Edited product",
  "stock.adjust": "Adjusted stock",
  "team.invite": "Invited staff",
  "team.join": "Joined business",
  "team.role_change": "Changed role",
  "team.remove": "Removed staff",
  "team.invite_revoke": "Revoked invitation",
  "data.export": "Exported data",
  "business.create": "Created business",
  "business.settings_update": "Updated settings",
  "billing.checkout_start": "Started subscription payment",
  "billing.payment_success": "Subscription payment confirmed",
  "billing.cancel": "Cancelled subscription",
  "billing.resume": "Resumed subscription",
  "billing.amount_mismatch": "Payment amount mismatch (rejected)",
  "admin.grant_access": "Support activated plan",
  "admin.extend_trial": "Support extended trial",
};

export default async function ActivityPage({ searchParams }: PageProps<"/app/activity">) {
  const sp = await searchParams;
  const { ctx, membership } = await requireBusiness();
  if (!can(membership.role, "audit.view")) redirect("/app");
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 50;
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where: { businessId: ctx.businessId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.auditLog.count({ where: { businessId: ctx.businessId } }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Activity log" subtitle="Who did what — sensitive actions are recorded and cannot be edited." />
      <Card>
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((r) => {
            const meta = (r.metadata ?? {}) as Record<string, unknown>;
            const detail = [meta.number, meta.receipt, meta.reason && `Reason: ${meta.reason}`, meta.kind && `(${meta.kind})`, meta.note].filter(Boolean).join(" · ");
            return (
              <li key={r.id} className="px-4 py-2.5">
                <p><span className="font-medium">{users.find((u) => u.id === r.userId)?.name ?? "System"}</span> — <span className={r.action.includes("override") || r.action.includes("void") || r.action.includes("mismatch") ? "text-red-700" : ""}>{LABELS[r.action] ?? r.action}</span>{detail ? <span className="text-slate-600"> · {String(detail)}</span> : null}</p>
                <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}{r.ip ? ` · ${r.ip}` : ""}</p>
              </li>
            );
          })}
        </ul>
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} total={total} href={(p) => withParams("/app/activity", { page: p })} />
      </Card>
    </>
  );
}
