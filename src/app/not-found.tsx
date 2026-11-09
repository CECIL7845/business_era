import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl font-bold text-brand-700">404</p>
      <h1 className="mt-3 text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-1 text-sm text-slate-600">It may have been removed, or it belongs to a different business.</p>
      <LinkButton href="/app" className="mt-6">Go to dashboard</LinkButton>
    </main>
  );
}
