import Link from "next/link";
import { db } from "@/lib/db";
import { DEFAULT_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { formatCedis } from "@/lib/money";
import { LinkButton } from "@/components/ui";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

// Prices come from the database so the page always matches what checkout charges.
export const dynamic = "force-dynamic";

const FEATURES: [string, string][] = [
  ["Credit limits that are actually enforced", "Set a limit per retailer. Sales reps cannot invoice beyond it; managers can override, and every override is logged with their name."],
  ["Know who owes what — instantly", "Live balances, overdue amounts and an aging report (1–30, 31–60, 61–90, 90+ days) for every customer. No more exercise books."],
  ["MoMo, cash, bank and cheque collections", "Record payments in seconds. Duplicate MoMo transaction IDs are blocked, and payments clear the oldest invoices first automatically."],
  ["Polite WhatsApp reminders", "One tap opens your WhatsApp with the balance and overdue amount filled in. You stay in control of every message."],
  ["Statements and receipts", "Printable invoices, receipts and customer statements — or send a summary by WhatsApp. Ends the “I already paid” arguments."],
  ["Stock that matches your sales", "Every invoice reduces stock; restocks and adjustments need a reason. Low-stock alerts on your dashboard."],
  ["Staff accountability", "Roles for owners, managers, sales reps and your accountant. See sales and collections by rep, and an activity log of voids and changes."],
  ["Light on data", "No heavy images or trackers. Works on budget Android phones over 3G, and installs to your home screen."],
];

const FAQ: [string, string][] = [
  ["Who is Businestra for?", "Wholesalers and distributors in Ghana who supply shops, kiosks, chop bars, pharmacies or supermarkets and let them pay later. If you track debts in a notebook or Excel, it is for you."],
  ["Do I need a computer?", "No. It works in the browser on any smartphone, tablet or laptop. You can add it to your phone's home screen like an app."],
  ["How do I pay for my subscription?", "With Mobile Money (MTN, Telecel, AT) or card through Paystack. We never charge automatically — you pay each month or year when you choose."],
  ["What happens if I stop paying?", "After a 7-day grace period your account becomes read-only. Nothing is deleted, and the owner can still export all records."],
  ["Is my data safe?", "Each business's data is strictly separated, connections are encrypted, staff permissions are enforced on our servers, and data is backed up daily."],
  ["Does it send messages to my customers automatically?", "No. Reminders open in your own WhatsApp or SMS app so you decide what is sent and to whom."],
  ["Are the invoices GRA E-VAT invoices?", "No. Businestra produces commercial invoices and statements for credit control. VAT-registered businesses must still issue VAT invoices through GRA-approved systems."],
  ["Can you set it up for me?", "Yes. We offer a paid setup service: we visit or call, load your customers, products and opening balances, and train your staff."],
];

export default async function LandingPage() {
  const dbPlans = await db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }).catch(() => []);
  const plans = dbPlans.length ? dbPlans : DEFAULT_PLANS.map((p) => ({ ...p }));
  return (
    <>
      <PublicHeader />
      <main>
        <section className="bg-gradient-to-b from-brand-50 to-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <p className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">For wholesalers &amp; distributors in Ghana</p>
            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Stop losing money to customers who buy on credit and pay late.</h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-600">Businestra tracks every retailer&apos;s balance, enforces credit limits, records MoMo and cash collections, and tells you exactly who to chase today.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/register" className="!px-6 !py-3 !text-base">Start {TRIAL_DAYS}-day free trial</LinkButton>
              <LinkButton href="/register?next=/onboarding" variant="secondary" className="!px-6 !py-3 !text-base">Try it with sample data</LinkButton>
            </div>
            <p className="mt-3 text-sm text-slate-500">No card or MoMo needed to start. Cancel any time.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold">The problem with selling on credit</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ["Debts live in notebooks", "When the book is lost, wet, or the rep leaves, nobody knows who owes what."],
              ["Credit grows silently", "One more carton on credit, and another… until a retailer owes far more than you would ever have agreed."],
              ["Collections are hard to check", "Did the rep collect GH₵500 or GH₵300? Was that MoMo payment already counted?"],
            ].map(([t, b]) => (
              <div key={t} className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-600">{b}</p></div>
            ))}
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold">Everything you need for credit control</h2>
            <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {FEATURES.map(([t, b]) => (
                <div key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">✓</span>
                  <div><h3 className="font-semibold">{t}</h3><p className="text-sm text-slate-600">{b}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-4">
            {["Add your products and retailers (or let us do it for you).", "Set a credit limit and payment terms for each retailer.", "Record credit sales and collections from any phone.", "Follow up overdue customers from the dashboard every morning."].map((s, i) => (
              <li key={s} className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><span className="text-2xl font-bold text-brand-700">{i + 1}</span><p className="mt-2 text-sm text-slate-700">{s}</p></li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold">Simple pricing in cedis</h2>
            <p className="mt-1 text-slate-600">Every plan includes unlimited invoices and payments. Pay monthly, or pay for 12 months and get 2 months free.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {plans.map((p) => (
                <div key={p.code} className={`rounded-2xl p-6 ring-1 ${p.code === "GROWTH" ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-slate-200"}`}>
                  {p.code === "GROWTH" && <p className="mb-2 text-xs font-semibold uppercase text-brand-700">Most popular</p>}
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  <p className="mt-2"><span className="text-3xl font-extrabold">{formatCedis(p.priceMonthly)}</span><span className="text-slate-500">/month</span></p>
                  <p className="text-sm text-slate-500">or {formatCedis(p.priceAnnual)} per year</p>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    <li>✓ {p.maxUsers} users</li>
                    <li>✓ {p.maxCustomers < 0 ? "Unlimited" : p.maxCustomers.toLocaleString("en-GH")} active customers</li>
                    <li>✓ Credit limits, aging, statements</li>
                    <li>✓ Stock tracking &amp; low-stock alerts</li>
                    <li>{p.canExport ? "✓ Excel/CSV exports for your accountant" : "— No exports"}</li>
                  </ul>
                  <LinkButton href="/register" variant={p.code === "GROWTH" ? "primary" : "secondary"} className="mt-5 w-full">Start free trial</LinkButton>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">Optional setup &amp; training service available — ask us for a quote.</p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-bold">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-4">
                <summary className="cursor-pointer list-none font-medium">{q}<span className="float-right text-slate-400 group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-sm text-slate-600">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-brand-800 p-8 text-center text-white">
            <h2 className="text-2xl font-bold">Know exactly who owes you — starting today</h2>
            <p className="mt-2 text-brand-100">Set up in minutes. {TRIAL_DAYS} days free.</p>
            <Link href="/register" className="mt-5 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-800 hover:bg-brand-50">Create your free account</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
