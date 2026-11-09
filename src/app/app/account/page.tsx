import { requireUser } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatGhanaPhone } from "@/lib/phone";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Alert, Card, PageHeader } from "@/components/ui";
import { changePasswordAction, signOutEverywhereAction, updateProfileAction } from "./actions";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: PageProps<"/app/account">) {
  const sp = await searchParams;
  const { user, session } = await requireUser();
  const sessions = await db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });
  return (
    <>
      <PageHeader title="My account" subtitle={user.email} />
      {sp.signedout && <div className="mb-4"><Alert tone="green">All other devices were signed out.</Alert></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Profile"><div className="p-5">
          <ActionForm action={updateProfileAction}>
            <Field name="name" label="Name" defaultValue={user.name} required />
            <Field name="phone" label="Phone" type="tel" defaultValue={formatGhanaPhone(user.phone)} />
            <p className="text-sm text-slate-500">Email: {user.email} {user.emailVerifiedAt ? "(confirmed)" : "(not confirmed)"}</p>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </div></Card>
        <Card title="Change password"><div className="p-5">
          <ActionForm action={changePasswordAction} resetOnSuccess>
            <Field name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
            <Field name="newPassword" label="New password" type="password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." />
            <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
            <SubmitButton>Change password</SubmitButton>
          </ActionForm>
        </div></Card>
        <Card title="Signed-in devices" className="lg:col-span-2">
          <ul className="divide-y divide-slate-100 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="px-4 py-2.5">
                <p className="truncate">{s.userAgent ?? "Unknown device"} {s.id === session.id && <strong className="text-brand-700">(this device)</strong>}</p>
                <p className="text-xs text-slate-500">Last active {formatDateTime(s.lastSeenAt)}{s.ip ? ` · IP ${s.ip}` : ""}</p>
              </li>
            ))}
          </ul>
          {sessions.length > 1 && (
            <div className="border-t border-slate-100 p-4">
              <ActionForm action={signOutEverywhereAction}><SubmitButton variant="secondary">Sign out all other devices</SubmitButton></ActionForm>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
