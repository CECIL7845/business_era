import { HelpGuide, SupportContacts } from "@/components/help-guide";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

export const metadata = { title: "Help & onboarding guide" };

export default function PublicHelpPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Getting started with Businestra</h1>
        <p className="mb-8 mt-2 text-slate-600">Most distributors are fully set up in under an hour. We also offer a paid on-site setup where we load your customers, products and opening balances for you.</p>
        <HelpGuide />
        <h2 className="mt-10 text-xl font-bold">Contact support</h2>
        <div className="mt-2"><SupportContacts /></div>
      </main>
      <PublicFooter />
    </>
  );
}
