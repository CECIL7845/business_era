import { NextResponse } from "next/server";
import { getSession, requestMeta } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { exportCsv, type ExportKind } from "@/lib/services/reports";
import { isAppError } from "@/lib/errors";
import { parseDay } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";

const KINDS: ExportKind[] = ["customers", "invoices", "payments", "aging"];

export async function GET(req: Request, { params }: RouteContext<"/api/export/[kind]">) {
  const { kind } = await params;
  if (!KINDS.includes(kind as ExportKind)) return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  const session = await getSession();
  if (!session?.activeBusinessId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const membership = await db.membership.findUnique({ where: { userId_businessId: { userId: session.userId, businessId: session.activeBusinessId } } });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const { ip } = await requestMeta();
  try {
    await enforceRateLimit(`export:${session.userId}`, 30, 3600);
    const { filename, csv } = await exportCsv(
      { userId: session.userId, businessId: membership.businessId, membershipId: membership.id, role: membership.role, ip },
      kind as ExportKind,
      parseDay(url.searchParams.get("from")) ?? undefined,
      parseDay(url.searchParams.get("to")) ?? undefined,
    );
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (isAppError(e)) return new NextResponse(e.message, { status: e.code === "FORBIDDEN" ? 403 : e.code === "RATE_LIMITED" ? 429 : 402, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    logger.error("export_failed", { err: e });
    return new NextResponse("Export failed", { status: 500 });
  }
}
