/**
 * Tracking Domain Service
 *
 * Handles watch session lifecycle and event recording.
 * The watch page does NOT require authentication — sessions are created anonymously.
 * The anon Supabase client is used for session/event inserts (RLS allows anon INSERT).
 * The admin client is used for watch_link resolution and session updates.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createAnonClient } from "@/utils/supabase/client";
import type { TrackingEventPayload } from "@/src/types/tracking";

export interface ResolvedWatchLink {
  watch_link_id: string;
  video_id: string;
  title: string;
  source_type: string;
  source_url: string;
  duration: number | null;
}

/**
 * Resolves a watch token to video info.
 * Returns null if token is invalid, expired, or video is deleted.
 */
export async function resolveWatchLink(token: string): Promise<ResolvedWatchLink | null> {
  if (!token || token.length < 10) return null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("watch_links")
      .select("id, expires_at, video_id, videos(id, title, source_type, source_url, duration)")
      .eq("token", token)
      .maybeSingle();

    if (error || !data || !data.videos) return null;

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

    const video = Array.isArray(data.videos) ? data.videos[0] : data.videos;
    if (!video) return null;

    return {
      watch_link_id: data.id,
      video_id: video.id,
      title: video.title,
      source_type: video.source_type,
      source_url: video.source_url,
      duration: video.duration ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a new watch session.
 * Called from the public tracking API (anon).
 * viewer_identifier is a simple hash of a viewer hint — never raw PII.
 */
export async function createWatchSession(
  watchLinkId: string,
  viewerHint: string | null
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    // Simple hash of viewer hint for rough uniqueness (not PII-grade)
    let viewerIdentifier: string | null = null;
    if (viewerHint) {
      const encoder = new TextEncoder();
      const data = encoder.encode(viewerHint);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      viewerIdentifier = hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    const { data, error } = await supabase
      .from("watch_sessions")
      .insert({
        watch_link_id: watchLinkId,
        viewer_identifier: viewerIdentifier,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Failed to create watch session", error);
      return null;
    }

    return data.id;
  } catch {
    return null;
  }
}

/**
 * Records a tracking event for a session.
 * Uses admin client (anon cannot read session to verify, so we skip verify for MVP).
 * Rate limiting / spam prevention is a post-MVP concern.
 */
export async function recordTrackingEvent(
  payload: TrackingEventPayload
): Promise<boolean> {
  if (!payload.session_id || !payload.event_type) return false;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("watch_events").insert({
      session_id: payload.session_id,
      event_type: payload.event_type,
      position: payload.position ?? 0,
      duration: payload.from_position ?? null,
    });

    if (error) {
      // Update last_seen_at on session (fire-and-forget)
      void supabase
        .from("watch_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", payload.session_id);
    }

    // Always update last_seen_at on heartbeat/play
    if (!error && (payload.event_type === "heartbeat" || payload.event_type === "play")) {
      void supabase
        .from("watch_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", payload.session_id);
    }

    return !error;
  } catch {
    return false;
  }
}

/**
 * Ends a watch session, recording final watch time and completion %.
 */
export async function endWatchSession(
  sessionId: string,
  watchTimeSeconds: number,
  completionPercentage: number
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("watch_sessions")
      .update({
        ended_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        watch_time_seconds: Math.round(watchTimeSeconds),
        completion_percentage: Math.min(100, Math.max(0, completionPercentage)),
      })
      .eq("id", sessionId);

    return !error;
  } catch {
    return false;
  }
}
