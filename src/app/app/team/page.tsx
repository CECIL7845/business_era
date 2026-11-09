import { requireBusiness } from "@/lib/auth/context";
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { ActionForm, ConfirmAction, Field, Select, SubmitButton } from "@/components/form";
import { Badge, Card, PageHeader } from "@/components/ui";
import type { Role } from "@/generated/prisma/enums";
import { changeRoleAction, inviteAction, removeMemberAction, revokeInviteAction } from "./actions";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { ctx, membership, entitlements } = await requireBusiness();
  const [members, invites] = await Promise.all([
    db.membership.findMany({ where: { businessId: ctx.businessId }, include: { user: { select: { name: true, email: true, phone: true } } }, orderBy: { createdAt: "asc" } }),
    db.invitation.findMany({ where: { businessId: ctx.businessId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const manage = can(membership.role, "team.manage");
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== "OWNER" || membership.role === "OWNER");
  const roleOptions = roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  return (
    <>
      <PageHeader title="Team" subtitle={`${members.length + invites.length} of ${entitlements.maxUsers} user seats used on your plan.`} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Members">
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{m.user.name} {m.id === membership.id && <Badge tone="blue">you</Badge>}</p>
                    <p className="truncate text-xs text-slate-500">{m.user.email} · joined {formatDate(m.createdAt)}</p>
                  </div>
                  {manage && m.id !== membership.id && (m.role !== "OWNER" || membership.role === "OWNER") ? (
                    <div className="flex items-end gap-2">
                      <ActionForm action={changeRoleAction} className="flex items-end gap-2 space-y-0">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select name="role" defaultValue={m.role} aria-label={`Role for ${m.user.name}`} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                          {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <SubmitButton variant="secondary" pendingText="…" className="!px-2.5 !py-1.5">Save</SubmitButton>
                      </ActionForm>
                      <ConfirmAction action={removeMemberAction} label="Remove" title={`Remove ${m.user.name}?`} body="They will immediately lose access to this business. Records they created stay." hidden={{ membershipId: m.id }} confirmLabel="Remove" />
                    </div>
                  ) : (
                    <Badge>{ROLE_LABELS[m.role]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {invites.length > 0 && (
            <Card title="Pending invitations">
              <ul className="divide-y divide-slate-100">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div><p className="text-sm font-medium">{i.email}</p><p className="text-xs text-slate-500">{ROLE_LABELS[i.role]} · expires {formatDate(i.expiresAt)}</p></div>
                    {manage && <ConfirmAction action={revokeInviteAction} label="Revoke" title="Revoke invitation?" body={`The link sent to ${i.email} will stop working.`} hidden={{ invitationId: i.id }} confirmLabel="Revoke" variant="secondary" />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          {manage && (
            <Card title="Invite a staff member">
              <div className="p-4">
                <ActionForm action={inviteAction} resetOnSuccess>
                  <Field name="email" label="Their email" type="email" required />
                  <Select name="role" label="Role" defaultValue="SALES" options={roleOptions} />
                  <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
                </ActionForm>
              </div>
            </Card>
          )}
          <Card title="What each role can do">
            <dl className="space-y-2 p-4 text-sm">
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <div key={r}><dt className="font-medium">{ROLE_LABELS[r]}</dt><dd className="text-slate-600">{ROLE_DESCRIPTIONS[r]}</dd></div>)}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
