import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-bold text-brand-800">
        <img src="/icon.svg" alt="" className="size-8" /> Businestra
      </Link>
      <main className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">{children}</main>
      <p className="mt-6 text-center text-xs text-slate-500">
        <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/help" className="hover:underline">Help</Link>
      </p>
    </div>
  );
}
