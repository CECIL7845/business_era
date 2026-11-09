import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Alert } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { loginAction } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  if (await getSession()) redirect("/app");
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <>
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">Welcome back. Sign in to your business account.</p>
      {sp.reset && <div className="mb-4"><Alert tone="green">Password changed. Sign in with your new password.</Alert></div>}
      <ActionForm action={loginAction}>
        <input type="hidden" name="next" value={next} />
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field name="password" label="Password" type="password" autoComplete="current-password" required />
        <div className="flex items-center justify-between">
          <Link href="/forgot-password" className="text-sm text-brand-700 hover:underline">Forgot password?</Link>
        </div>
        <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-sm text-slate-600">
        New to Businestra? <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-brand-700 hover:underline">Start a free 14-day trial</Link>
      </p>
    </>
  );
}
