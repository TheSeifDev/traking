/**
 * /api/tracking/session/[sessionId]/end
 * POST - End the authenticated viewer's watch session.
 */
import { NextRequest, NextResponse } from "next/server";
import { endWatchSession } from "@/src/lib/tracking/service";
import { resolveWatchActor } from "@/src/lib/tracking/viewer-identity";
import type { EndSessionPayload } from "@/src/types/tracking";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params;
  const actor = await resolveWatchActor(request);
  if (!actor) return NextResponse.json({ error: "viewer_identity_required" }, { status: 401 });
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<EndSessionPayload>;
  const sessionToken = typeof b.session_token === "string" ? b.session_token.trim() : "";
  const watchTime = typeof b.watch_time_seconds === "number" && Number.isFinite(b.watch_time_seconds)
    ? Math.max(0, b.watch_time_seconds)
    : 0;
  const completion = typeof b.completion_percentage === "number" && Number.isFinite(b.completion_percentage)
    ? Math.min(100, Math.max(0, b.completion_percentage))
    : 0;
  const position = typeof b.position === "number" && Number.isFinite(b.position) ? Math.max(0, b.position) : null;
  const finalDuration = typeof b.duration === "number" && Number.isFinite(b.duration) && b.duration > 0 ? b.duration : null;
  const finalEvent = b.final_event && typeof b.final_event === "object"
    ? {
        client_event_id: typeof b.final_event.client_event_id === "string" ? b.final_event.client_event_id.trim().slice(0, 100) : null,
        sequence_number: typeof b.final_event.sequence_number === "number" && Number.isInteger(b.final_event.sequence_number) ? Math.max(0, Math.min(1000000, b.final_event.sequence_number)) : null,
        occurred_at: typeof b.final_event.occurred_at === "string" && !Number.isNaN(new Date(b.final_event.occurred_at).getTime()) ? b.final_event.occurred_at : null,
      }
    : {};

  if (!sessionToken) return NextResponse.json({ error: "missing_session_token" }, { status: 400 });

  const ok = await endWatchSession(sessionId, sessionToken, actor, watchTime, completion, position, finalDuration, finalEvent);
  // Do not reveal whether the session id exists when the capability or identity is invalid.
  if (!ok) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

  return NextResponse.json({ ended: true });
}