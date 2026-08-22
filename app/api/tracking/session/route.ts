/**
 * /api/tracking/session
 * POST - Create a new watch session (public — no auth required)
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveWatchLink, createWatchSession } from "@/src/lib/tracking/service";
import type { CreateSessionPayload } from "@/src/types/tracking";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const b = body as Partial<CreateSessionPayload>;
  const token = typeof b.watch_link_token === "string" ? b.watch_link_token.trim() : "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const resolved = await resolveWatchLink(token);
  if (!resolved) return NextResponse.json({ error: "invalid_token" }, { status: 404 });

  const viewerHint = typeof b.viewer_hint === "string" ? b.viewer_hint : null;
  const sessionId = await createWatchSession(resolved.watch_link_id, viewerHint);
  if (!sessionId) return NextResponse.json({ error: "session_creation_failed" }, { status: 500 });

  return NextResponse.json({ session_id: sessionId }, { status: 201 });
}