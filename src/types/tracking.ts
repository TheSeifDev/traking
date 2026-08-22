/**
 * TrackUp Tracking Event Types
 *
 * These are the events the client sends to /api/tracking/event.
 * Design principles:
 *   - Never send a DB write on every timeupdate (too many writes).
 *   - Emit meaningful semantic events: play, pause, seek, heartbeat, complete, ended.
 *   - Heartbeat is throttled client-side (every ~5 seconds while playing).
 *   - From events array, the server can reconstruct watched segments.
 */

export type TrackingEventType =
  | "play"
  | "pause"
  | "seek"
  | "heartbeat"
  | "complete"
  | "ended";

export const VALID_EVENT_TYPES: readonly TrackingEventType[] = [
  "play",
  "pause",
  "seek",
  "heartbeat",
  "complete",
  "ended",
] as const;

export function isValidEventType(v: unknown): v is TrackingEventType {
  return typeof v === "string" && (VALID_EVENT_TYPES as readonly string[]).includes(v);
}

/**
 * Body sent by the client to POST /api/tracking/event
 */
export interface TrackingEventPayload {
  session_id: string;
  event_type: TrackingEventType;
  /** Current playhead position in seconds */
  position: number;
  /** For seek: the position seeked FROM. For heartbeat/other: optional. */
  from_position?: number | null;
}

/**
 * Body sent by the client to POST /api/tracking/session
 */
export interface CreateSessionPayload {
  watch_link_token: string;
  /** Optional viewer fingerprint – hashed by the server, never stored raw */
  viewer_hint?: string | null;
}

/**
 * Body sent by the client to POST /api/tracking/session/[id]/end
 */
export interface EndSessionPayload {
  session_id: string;
  watch_time_seconds: number;
  completion_percentage: number;
}

/**
 * Response from POST /api/tracking/session
 */
export interface CreateSessionResponse {
  session_id: string;
}

/**
 * Represents a reconstructed watched segment (server-side computation)
 */
export interface WatchedSegment {
  start: number;
  end: number;
}
