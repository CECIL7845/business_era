"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">Your data is safe. Please try again. If this keeps happening, contact support{error.digest ? ` and quote code ${error.digest}` : ""}.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className={buttonClass()}>Try again</button>
        <a href="/app" className={buttonClass("secondary")}>Dashboard</a>
      </div>
    </main>
  );
}
