import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/src/lib/health/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function hasValidCronAuthorization(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function GET(request: NextRequest) {
  if (!hasValidCronAuthorization(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const health = await checkDatabaseHealth();
  if (health.status === "degraded") {
    return NextResponse.json(
      { status: "degraded", error: health.error, latency_ms: health.latency_ms },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { status: "ok", latency_ms: health.latency_ms },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
