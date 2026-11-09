import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { runDailyJobs } from "@/lib/services/cron";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Call once a day from your scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runDailyJobs());
  } catch (err) {
    logger.error("cron_daily_failed", { err });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

/** Vercel Cron sends GET with the same `Authorization: Bearer $CRON_SECRET` header. */
export const GET = POST;
