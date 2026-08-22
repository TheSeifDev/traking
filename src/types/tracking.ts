/**
 * TrackUp Tracking Event Types.
 *
 * Events are emitted only after an authenticated viewer has opened the internal
 * viewer and the provider reports actual playback. Provider adapters must not
 * invent telemetry that the provider does not expose.
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

/** Body sent by the client to POST /api/tracking/event. */
export interface TrackingEventPayload {
  session_id: string;
  /** Private capability returned only to the authenticated viewer session. */
  session_token: string;
  event_type: TrackingEventType;
  /** Current playhead position in seconds. */
  position: number;
  /** Provider duration in seconds when the player exposes it. */
  duration?: number | null;
  /** For seek: the position seeked FROM. */
  from_position?: number | null;
}

/** Body sent by the client to POST /api/tracking/session. */
export interface CreateSessionPayload {
  watch_link_token: string;
}

/** Body sent by the client to POST /api/tracking/session/[id]/end. */
export interface EndSessionPayload {
  session_id: string;
  /** Private capability returned only to the authenticated viewer session. */
  session_token: string;
  watch_time_seconds: number;
  completion_percentage: number;
}

/** Response from POST /api/tracking/session. */
export interface CreateSessionResponse {
  session_id: string;
  /** Private capability required for subsequent tracking writes. */
  session_token: string;
}

export interface WatchedSegment {
  start: number;
  end: number;
}
