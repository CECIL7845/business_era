import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Alert } from "@/components/ui";
import { resetPasswordAction } from "../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return <Alert tone="red" title="Invalid link">This reset link is incomplete. <Link href="/forgot-password" className="underline">Request a new one</Link>.</Alert>;
  }
  return (
    <>
      <h1 className="text-xl font-bold">Choose a new password</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">You&apos;ll be signed out of all other devices.</p>
      <ActionForm action={resetPasswordAction}>
        <input type="hidden" name="token" value={token} />
        <Field name="password" label="New password" type="password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." />
        <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Set new password</SubmitButton>
      </ActionForm>
    </>
  );
}
