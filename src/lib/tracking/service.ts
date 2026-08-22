/**
 * Tracking Domain Service
 *
 * Handles watch session lifecycle and event recording.
 * The watch page does NOT require authentication — sessions are created anonymously.
 * The session capability token is returned only to the viewer and is required for
 * subsequent event and end-session writes.
 */
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
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
      .select("id, expires_at, revoked_at, video_id, videos(id, title, source_type, source_url, duration)")
      .eq("token", token)
      .maybeSingle();

    if (error || !data || !data.videos) return null;
    if (data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;

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
 * Creates a new anonymous watch session and returns its private capability.
 * viewer_identifier is a simple hash of a viewer hint — never raw PII.
 */
export async function createWatchSession(
  watchLinkId: string,
  viewerHint: string | null
): Promise<{ id: string; sessionToken: string } | null> {
  try {
    const supabase = createAdminClient();

    // Re-check the link immediately before inserting the session to close the
    // resolve-then-insert race with revoke/expiry changes.
    const { data: activeLink, error: linkError } = await supabase
      .from("watch_links")
      .select("id, expires_at, revoked_at")
      .eq("id", watchLinkId)
      .maybeSingle();
    if (
      linkError ||
      !activeLink ||
      activeLink.revoked_at ||
      (activeLink.expires_at && new Date(activeLink.expires_at) <= new Date())
    ) {
      return null;
    }

    const sessionToken = randomBytes(32).toString("hex");

    let viewerIdentifier: string | null = null;
    if (viewerHint) {
      const encoder = new TextEncoder();
      const data = encoder.encode(viewerHint);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      viewerIdentifier = hashArray
        .slice(0, 8)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }

    const { data, error } = await supabase
      .from("watch_sessions")
      .insert({
        watch_link_id: watchLinkId,
        viewer_identifier: viewerIdentifier,
        session_token: sessionToken,
      })
      .select("id, session_token")
      .single();

    if (error || !data) {
      console.error("Failed to create watch session", error);
      return null;
    }

    return { id: data.id, sessionToken: data.session_token };
  } catch {
    return null;
  }
}

/**
 * Checks the private capability before allowing an anonymous session write.
 * This deliberately returns only a boolean so callers cannot distinguish an
 * unknown session id from a known id with a wrong capability.
 */
export async function isAuthorizedWatchSession(
  sessionId: string,
  sessionToken: string
): Promise<boolean> {
  if (!sessionId || !sessionToken) return false;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("watch_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Records a tracking event for an authorized anonymous session.
 * The capability is checked before the event insert and is also used to scope
 * the last-seen update.
 */
export async function recordTrackingEvent(
  payload: TrackingEventPayload
): Promise<boolean> {
  if (!payload.session_id || !payload.session_token || !payload.event_type) return false;
  if (!(await isAuthorizedWatchSession(payload.session_id, payload.session_token))) return false;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("watch_events").insert({
      session_id: payload.session_id,
      event_type: payload.event_type,
      position: payload.position ?? 0,
      from_position: payload.from_position ?? null,
    });

    if (!error && (payload.event_type === "heartbeat" || payload.event_type === "play")) {
      void supabase
        .from("watch_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", payload.session_id)
        .eq("session_token", payload.session_token);
    }

    return !error;
  } catch {
    return false;
  }
}

/**
 * Ends a watch session, recording final watch time and completion %.
 * The update is scoped by both session id and its private capability.
 */
export async function endWatchSession(
  sessionId: string,
  sessionToken: string,
  watchTimeSeconds: number,
  completionPercentage: number
): Promise<boolean> {
  if (!sessionId || !sessionToken) return false;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("watch_sessions")
      .update({
        ended_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        watch_time_seconds: Math.round(watchTimeSeconds),
        completion_percentage: Math.min(100, Math.max(0, completionPercentage)),
      })
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .select("id")
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}
