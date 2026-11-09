import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { requireUser } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { logoutAction } from "@/app/(auth)/actions";
import { createBusinessAction, createDemoAction } from "./actions";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const { user } = await requireUser();
  const hasBusiness = (await db.membership.count({ where: { userId: user.id } })) > 0;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-800"><img src="/icon.svg" alt="" className="size-7" /> Businestra</Link>
        <form action={logoutAction}><button className="text-sm text-slate-500 hover:text-slate-800">Sign out</button></form>
      </div>
      <h1 className="text-2xl font-bold">Welcome, {user.name.split(" ")[0]}! Let&apos;s set up your business.</h1>
      <p className="mt-1 text-slate-600">This takes about a minute. You can change everything later in Settings.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:col-span-3">
          <h2 className="mb-4 font-semibold">Your business details</h2>
          <ActionForm action={createBusinessAction}>
            <Field name="name" label="Business name" required placeholder="e.g. Asante Distributors Ltd" />
            <Field name="phone" label="Business phone" type="tel" placeholder="024 123 4567" hint="Printed on invoices and receipts." />
            <Field name="city" label="Town / city" placeholder="e.g. Kumasi" />
            <Field name="defaultCreditDays" label="Usual credit period (days)" type="number" inputMode="numeric" min={0} max={365} defaultValue="14" hint="How long retailers normally get to pay. Each customer can have their own terms." />
            <SubmitButton className="w-full" pendingText="Setting up…">Create my business</SubmitButton>
          </ActionForm>
        </section>
        <section className="rounded-xl bg-brand-50 p-5 ring-1 ring-brand-100 md:col-span-2">
          <h2 className="font-semibold text-brand-800">Just looking around?</h2>
          <p className="mt-1 text-sm text-slate-700">Open a separate demo business filled with fictional retailers, invoices and payments. It&apos;s clearly marked as sample data and never mixes with your real records.</p>
          <ActionForm action={createDemoAction} className="mt-4">
            <SubmitButton variant="secondary" className="w-full" pendingText="Building demo (a few seconds)…">Explore with sample data</SubmitButton>
          </ActionForm>
          {hasBusiness && <Link href="/app" className="mt-4 block text-sm text-brand-700 underline">Back to my dashboard</Link>}
        </section>
      </div>
    </div>
  );
}
