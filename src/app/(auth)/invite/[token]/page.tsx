import { ActionForm, SubmitButton } from "@/components/form";
import { Alert, LinkButton } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getInvitation } from "@/lib/services/team";
import { acceptInviteAction, logoutAction } from "../../actions";

export const metadata = { title: "Join a business" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const inv = token.length < 100 ? await getInvitation(token) : null;
  if (!inv) return <Alert tone="red" title="Invitation not valid">This invitation has expired, was revoked, or was already used. Ask the business owner to send a new one.</Alert>;
  const session = await getSession();
  const here = `/invite/${token}`;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Join {inv.business.name}</h1>
      <p className="text-sm text-slate-600">
        You&apos;ve been invited as <strong>{ROLE_LABELS[inv.role]}</strong>. This invitation is for <strong>{inv.email}</strong>.
      </p>
      {!session ? (
        <div className="grid gap-2">
          <LinkButton href={`/register?next=${encodeURIComponent(here)}`}>Create an account to accept</LinkButton>
          <LinkButton variant="secondary" href={`/login?next=${encodeURIComponent(here)}`}>I already have an account</LinkButton>
        </div>
      ) : session.user.email !== inv.email ? (
        <>
          <Alert tone="amber">You&apos;re signed in as {session.user.email}. Sign out and sign in (or register) as {inv.email} to accept.</Alert>
          <form action={logoutAction}><button className="text-sm text-brand-700 underline">Sign out</button></form>
        </>
      ) : (
        <ActionForm action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full" pendingText="Joining…">Accept and join</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
