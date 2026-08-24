/**
 * TrackUp Tracking Event Types.
 *
 * Events are emitted only after an authenticated viewer has opened the internal
 * viewer and the provider reports actual playback. Provider adapters must not
 * invent telemetry that the provider does not expose.
 */

export type TrackingEventType =
  | "play"
  | "resume"
  | "pause"
  | "seek"
  | "heartbeat"
  | "complete"
  | "ended"
  | "buffer"
  | "rate_change"
  | "visibility_change";

export const VALID_EVENT_TYPES: readonly TrackingEventType[] = [
  "play",
  "resume",
  "pause",
  "seek",
  "heartbeat",
  "complete",
  "ended",
  "buffer",
  "rate_change",
  "visibility_change",
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
  /** Client-generated retry-safe idempotency key. */
  client_event_id?: string | null;
  /** Monotonic order within one session. */
  sequence_number?: number | null;
  /** Provider event time, separate from server receipt time. */
  occurred_at?: string | null;
  /** Actual provider playback rate at event time. */
  playback_rate?: number | null;
  /** Actual previous/new rates for rate_change events. */
  from_rate?: number | null;
  to_rate?: number | null;
  /** Non-PII provider metadata such as visibility or buffering state. */
  metadata?: Record<string, string | number | boolean | null>;
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
  /** Final player position on natural end or page leave when available. */
  position?: number | null;
  /** Final provider duration on natural end or page leave when available. */
  duration?: number | null;
  /** Ordered final event written atomically with the session end. */
  final_event?: {
    client_event_id?: string | null;
    sequence_number?: number | null;
    occurred_at?: string | null;
  };
}

/** Response from POST /api/tracking/session. */
export interface CreateSessionResponse {
  session_id: string;
  /** Private capability required for subsequent tracking writes. */
  session_token: string;
}

export interface TrackingEventBatchPayload {
  session_id: string;
  session_token: string;
  events: TrackingEventPayload[];
}

export interface WatchedSegment {
  start: number;
  end: number;
}
