import { Alert, LinkButton } from "@/components/ui";
import { verifyEmailToken } from "@/lib/services/auth";

export const metadata = { title: "Confirm email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const ok = typeof token === "string" && token.length < 100 && (await verifyEmailToken(token));
  return (
    <div className="space-y-4">
      {ok ? <Alert tone="green" title="Email confirmed">Thank you — your email address is confirmed.</Alert> : <Alert tone="red" title="Link invalid or expired">Sign in and use “Resend confirmation email” on your dashboard to get a new link.</Alert>}
      <LinkButton href="/app" className="w-full">Go to your dashboard</LinkButton>
    </div>
  );
}
