/**
 * /api/tracking/event
 * POST - Record an event for the authenticated TrackUp viewer's session.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { recordTrackingEvent } from "@/src/lib/tracking/service";
import { isValidEventType } from "@/src/types/tracking";
import type { TrackingEventPayload } from "@/src/types/tracking";

export const POST = withAuth(async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<TrackingEventPayload>;
  const session_id = typeof b.session_id === "string" ? b.session_id.trim() : "";
  const session_token = typeof b.session_token === "string" ? b.session_token.trim() : "";
  const event_type = b.event_type;
  const position = typeof b.position === "number" && Number.isFinite(b.position) ? Math.max(0, b.position) : 0;
  const duration = typeof b.duration === "number" && Number.isFinite(b.duration) && b.duration > 0 ? b.duration : null;

  if (!session_id) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  if (!session_token) return NextResponse.json({ error: "missing_session_token" }, { status: 400 });
  if (!isValidEventType(event_type)) return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });

  const ok = await recordTrackingEvent({
    session_id,
    session_token,
    event_type,
    position,
    duration,
    from_position: typeof b.from_position === "number" && Number.isFinite(b.from_position) ? Math.max(0, b.from_position) : null,
  }, user.id);

  // Do not reveal whether the session id exists when the capability or identity is invalid.
  if (!ok) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  return NextResponse.json({ recorded: true });
});
