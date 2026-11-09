import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { handleCallback } from "@/lib/services/billing";
import { logger } from "@/lib/logger";

// Paystack redirects the browser here after checkout. We never trust the redirect
// itself: the reference is verified server-to-server with Paystack before any access
// is granted. The webhook does the same independently, and processing is idempotent.
export default async function BillingCallbackPage({ searchParams }: PageProps<"/app/billing/callback">) {
  const sp = await searchParams;
  const reference = typeof sp.reference === "string" ? sp.reference : typeof sp.trxref === "string" ? sp.trxref : "";
  const { ctx } = await requireBusiness();
  let result = "pending";
  if (reference && reference.length < 100) {
    try {
      const r = await handleCallback(ctx, reference);
      result = r === "applied" || r === "already_applied" ? "success" : r === "failed" || r === "mismatch" ? "failed" : "pending";
    } catch (err) {
      logger.warn("billing_callback_error", { reference, err });
    }
  }
  redirect(`/app/billing?result=${result}`);
}
