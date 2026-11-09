import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/form";
import { getSession } from "@/lib/auth/session";
import { registerAction } from "../actions";

export const metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  if (await getSession()) redirect("/app");
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <>
      <h1 className="text-xl font-bold">Create your account</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">14 days free on the Growth plan. No card or MoMo needed to start.</p>
      <ActionForm action={registerAction}>
        <input type="hidden" name="next" value={next} />
        <Field name="name" label="Your name" autoComplete="name" required />
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field name="phone" label="Phone (optional)" type="tel" autoComplete="tel" placeholder="024 123 4567" hint="Used only for account support." />
        <Field name="password" label="Password" type="password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." />
        <Checkbox name="terms" label={<>I agree to the <Link href="/terms" className="text-brand-700 underline" target="_blank">Terms</Link> and <Link href="/privacy" className="text-brand-700 underline" target="_blank">Privacy Policy</Link></>} />
        <SubmitButton className="w-full" pendingText="Creating account…">Create account</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </>
  );
}
