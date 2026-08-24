/**
 * /api/tracking/event
 * POST - Record one or more events for the authenticated TrackUp viewer's session.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { getTrackingSessionSpaceId, recordTrackingEvents } from "@/src/lib/tracking/service";
import { authorizeSpaceMember } from "@/src/lib/spaces/access";
import { isValidEventType, type TrackingEventPayload } from "@/src/types/tracking";

const MAX_BATCH_SIZE = 50;
const MAX_CLIENT_EVENT_ID_LENGTH = 100;
const MAX_METADATA_BYTES = 512;

type RawEvent = Partial<Omit<TrackingEventPayload, "session_id" | "session_token">>;

function normalizeMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (Object.keys(result).length >= 12) break;
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) result[key.slice(0, 40)] = item;
  }
  try {
    return JSON.stringify(result).length <= MAX_METADATA_BYTES ? result : {};
  } catch {
    return {};
  }
}

function normalizeEvent(value: unknown): Omit<TrackingEventPayload, "session_id" | "session_token"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as RawEvent;
  if (!isValidEventType(event.event_type)) return null;
  const clientEventId = typeof event.client_event_id === "string" ? event.client_event_id.trim() : null;
  if (clientEventId && (clientEventId.length > MAX_CLIENT_EVENT_ID_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(clientEventId))) return null;
  const rawSequence = typeof event.sequence_number === "number" && Number.isInteger(event.sequence_number) ? event.sequence_number : null;
  const sequenceNumber = rawSequence === null ? null : Math.max(0, Math.min(1000000, rawSequence));
  const occurredAt = typeof event.occurred_at === "string" && !Number.isNaN(new Date(event.occurred_at).getTime()) ? event.occurred_at : null;
  const normalizeRate = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(8, value) : null;
  return {
    event_type: event.event_type,
    position: typeof event.position === "number" && Number.isFinite(event.position) ? Math.max(0, event.position) : 0,
    duration: typeof event.duration === "number" && Number.isFinite(event.duration) && event.duration > 0 ? event.duration : null,
    from_position: typeof event.from_position === "number" && Number.isFinite(event.from_position) ? Math.max(0, event.from_position) : null,
    client_event_id: clientEventId,
    sequence_number: sequenceNumber,
    occurred_at: occurredAt,
    playback_rate: normalizeRate(event.playback_rate),
    from_rate: normalizeRate(event.from_rate),
    to_rate: normalizeRate(event.to_rate),
    metadata: normalizeMetadata(event.metadata),
  };
}

export const POST = withAuth(async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const root = body as { session_id?: unknown; session_token?: unknown; events?: unknown };
  const sessionId = typeof root.session_id === "string" ? root.session_id.trim() : "";
  const sessionToken = typeof root.session_token === "string" ? root.session_token.trim() : "";
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  if (!sessionToken) return NextResponse.json({ error: "missing_session_token" }, { status: 400 });

  const rawEvents = Array.isArray(root.events) ? root.events : [body];
  if (rawEvents.length === 0 || rawEvents.length > MAX_BATCH_SIZE) return NextResponse.json({ error: "invalid_batch_size" }, { status: 400 });
  const events = rawEvents.map(normalizeEvent);
  if (events.some((event) => event === null)) return NextResponse.json({ error: "invalid_event" }, { status: 400 });

  const spaceId = await getTrackingSessionSpaceId(sessionId, user.id);
  if (!spaceId) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  try {
    await authorizeSpaceMember(spaceId, user);
  } catch {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const ok = await recordTrackingEvents(
    sessionId,
    sessionToken,
    events.map((event) => ({ ...event as Omit<TrackingEventPayload, "session_id" | "session_token">, session_id: sessionId, session_token: sessionToken })),
    user.id,
  );

  // Do not reveal whether the session id exists when the capability or identity is invalid.
  if (!ok) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  return NextResponse.json({ recorded: true, count: events.length });
});
