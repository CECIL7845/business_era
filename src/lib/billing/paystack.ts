import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Paystack REST API (https://paystack.com/docs/api/). Amounts are in the currency
// subunit — pesewas for GHS — which matches our storage.
const BASE_URL = () => process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co";
const secret = () => process.env.PAYSTACK_SECRET_KEY ?? "";

export const paystackConfigured = () => secret().length > 0;
export const paystackMode = () => (secret().startsWith("sk_live_") ? "live" : "test");

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!paystackConfigured()) throw new AppError("PAYMENT_PROVIDER", "Online payment is not configured yet. Please contact support to pay by MoMo or bank transfer.");
  let res: Response;
  try {
    res = await fetch(`${BASE_URL()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (err) {
    logger.error("paystack_network_error", { path, err });
    throw new AppError("PAYMENT_PROVIDER", "Could not reach the payment provider. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) {
    logger.error("paystack_api_error", { path, httpStatus: res.status, message: body?.message });
    throw new AppError("PAYMENT_PROVIDER", "The payment provider rejected the request. Please try again or contact support.");
  }
  return body.data as T;
}

export async function initializeTransaction(input: { email: string; amount: number; reference: string; callbackUrl: string; metadata: Record<string, unknown> }) {
  const data = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      currency: "GHS",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ["mobile_money", "card", "bank_transfer"],
      metadata: input.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url, accessCode: data.access_code };
}

export type VerifiedTransaction = {
  reference: string;
  status: string; // success | failed | abandoned | ongoing | pending | reversed ...
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  gatewayResponse: string | null;
};

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const d = await call<{ reference: string; status: string; amount: number; currency: string; channel?: string; paid_at?: string | null; gateway_response?: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return {
    reference: d.reference,
    status: d.status,
    amount: d.amount,
    currency: d.currency,
    channel: d.channel ?? null,
    paidAt: d.paid_at ? new Date(d.paid_at) : null,
    gatewayResponse: d.gateway_response ?? null,
  };
}

/** Paystack signs the raw request body with HMAC-SHA512 using the secret key. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !paystackConfigured()) return false;
  const expected = createHmac("sha512", secret()).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
