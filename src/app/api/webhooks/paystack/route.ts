import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { verifyWebhookSignature } from "@/lib/billing/paystack";
import { reconcileReference } from "@/lib/services/billing";

/**
 * Paystack webhook. Security layers:
 *  1. HMAC-SHA512 signature over the raw body (rejects forged requests).
 *  2. Event de-duplication by body hash (Paystack retries deliveries).
 *  3. Server-to-server re-verification of the transaction before granting access.
 *  4. Idempotent application (appliedAt guard) — safe even if 1–3 race.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    logger.warn("paystack_webhook_bad_signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const eventKey = sha256(raw);
  const eventType = String(event.event ?? "unknown").slice(0, 100);

  const existing = await db.webhookEvent.findUnique({ where: { provider_eventKey: { provider: "paystack", eventKey } } });
  if (existing?.processedAt) return NextResponse.json({ received: true, duplicate: true });
  if (!existing) {
    try {
      await db.webhookEvent.create({ data: { provider: "paystack", eventKey, eventType } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ received: true, duplicate: true });
      throw e;
    }
  }

  try {
    const reference = event.data?.reference;
    if (eventType === "charge.success" && typeof reference === "string" && reference.startsWith("bz_")) {
      const result = await reconcileReference(reference);
      logger.info("paystack_webhook_processed", { eventType, reference, result });
    }
    await db.webhookEvent.update({ where: { provider_eventKey: { provider: "paystack", eventKey } }, data: { processedAt: new Date(), error: null } });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("paystack_webhook_failed", { eventType, err });
    await db.webhookEvent.update({ where: { provider_eventKey: { provider: "paystack", eventKey } }, data: { error: String(err).slice(0, 500) } }).catch(() => {});
    // Non-2xx makes Paystack retry later; processing is idempotent.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
