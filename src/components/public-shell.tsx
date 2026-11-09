import Link from "next/link";
import { buttonClass } from "./ui";

export function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-800"><img src="/icon.svg" alt="" className="size-7" /> Businestra</Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          <Link href="/#pricing" className="hidden px-2 py-1 text-slate-600 hover:text-slate-900 sm:block">Pricing</Link>
          <Link href="/#faq" className="hidden px-2 py-1 text-slate-600 hover:text-slate-900 sm:block">FAQ</Link>
          <Link href="/login" className="px-2 py-1 text-slate-600 hover:text-slate-900">Sign in</Link>
          <Link href="/register" className={buttonClass("primary", "sm")}>Start free trial</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4 py-8 text-sm text-slate-500">
        <p>© {new Date().getFullYear()} Businestra · Made for Ghanaian distributors</p>
        <nav className="flex gap-4"><Link href="/help" className="hover:text-slate-800">Help</Link><Link href="/privacy" className="hover:text-slate-800">Privacy</Link><Link href="/terms" className="hover:text-slate-800">Terms</Link></nav>
      </div>
    </footer>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200"><strong>Draft for legal review.</strong> This document has not yet been reviewed by a Ghanaian lawyer and must be reviewed before commercial launch.</div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Last updated {updated}</p>
        <div className="prose-sm mt-6 space-y-4 text-slate-700 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      </main>
      <PublicFooter />
    </>
  );
}
