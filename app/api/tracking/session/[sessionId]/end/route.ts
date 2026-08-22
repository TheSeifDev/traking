/**
 * /api/tracking/session/[sessionId]/end
 * POST - End a watch session with final metrics (public — no auth required)
 */
import { NextRequest, NextResponse } from "next/server";
import { endWatchSession } from "@/src/lib/tracking/service";
import type { EndSessionPayload } from "@/src/types/tracking";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params;
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const b = body as Partial<EndSessionPayload>;
  const watchTime = typeof b.watch_time_seconds === "number" ? Math.max(0, Math.round(b.watch_time_seconds)) : 0;
  const completion = typeof b.completion_percentage === "number" ? Math.min(100, Math.max(0, b.completion_percentage)) : 0;

  const ok = await endWatchSession(sessionId, watchTime, completion);
  if (!ok) return NextResponse.json({ error: "end_failed" }, { status: 500 });

  return NextResponse.json({ ended: true });
}