/**
 * /api/tracking/event
 * POST - Record a tracking event (public — no auth required)
 */
import { NextRequest, NextResponse } from "next/server";
import { recordTrackingEvent } from "@/src/lib/tracking/service";
import { isValidEventType } from "@/src/types/tracking";
import type { TrackingEventPayload } from "@/src/types/tracking";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const b = body as Partial<TrackingEventPayload>;
  const session_id = typeof b.session_id === "string" ? b.session_id.trim() : "";
  const session_token = typeof b.session_token === "string" ? b.session_token.trim() : "";
  const event_type = b.event_type;
  const position = typeof b.position === "number" ? b.position : 0;

  if (!session_id) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  if (!session_token) return NextResponse.json({ error: "missing_session_token" }, { status: 400 });
  if (!isValidEventType(event_type)) return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });

  const ok = await recordTrackingEvent({
    session_id,
    session_token,
    event_type,
    position,
    from_position: typeof b.from_position === "number" ? b.from_position : null,
  });

  // Do not reveal whether the session id exists when the capability is invalid.
  if (!ok) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  return NextResponse.json({ recorded: true });
}