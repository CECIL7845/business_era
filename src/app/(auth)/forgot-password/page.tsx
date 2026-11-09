import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Forgot your password?</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
      <ActionForm action={forgotPasswordAction} resetOnSuccess>
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-sm"><Link href="/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
    </>
  );
}
