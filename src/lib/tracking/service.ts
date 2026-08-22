/**
 * Tracking Domain Service
 *
 * Handles authenticated watch session lifecycle and event recording.
 * The session capability token is returned only to the viewer and is required for
 * subsequent event and end-session writes. The stable viewer identifier is a
 * one-way hash of the authenticated TrackUp profile id.
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
 * Creates a new authenticated watch session and returns its private capability.
 * viewer_identifier is a stable one-way hash of the profile id — never raw PII.
 */
export async function createWatchSession(
  watchLinkId: string,
  viewerIdentity: string,
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

    const viewerIdentifier = await hashViewerIdentity(viewerIdentity);

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
 * Checks the private capability and authenticated viewer identity before allowing a session write.
 * This deliberately returns only a boolean so callers cannot distinguish an
 * unknown session id from a known id with a wrong capability.
 */
async function hashViewerIdentity(viewerIdentity: string): Promise<string> {
  const data = new TextEncoder().encode(`profile:${viewerIdentity}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isAuthorizedWatchSession(
  sessionId: string,
  sessionToken: string,
  viewerIdentity: string,
): Promise<boolean> {
  if (!sessionId || !sessionToken) return false;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("watch_sessions")
      .select("id, viewer_identifier")
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .is("ended_at", null)
      .maybeSingle();

    if (error || !data) return false;
    return data.viewer_identifier === await hashViewerIdentity(viewerIdentity);
  } catch {
    return false;
  }
}

/**
 * Records a tracking event for an authorized authenticated session.
 * The capability is checked before the event insert and is also used to scope
 * the last-seen update.
 */
export async function recordTrackingEvent(
  payload: TrackingEventPayload,
  viewerIdentity: string,
): Promise<boolean> {
  if (!payload.session_id || !payload.session_token || !payload.event_type) return false;
  if (!(await isAuthorizedWatchSession(payload.session_id, payload.session_token, viewerIdentity))) return false;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("watch_events").insert({
      session_id: payload.session_id,
      event_type: payload.event_type,
      position: payload.position ?? 0,
      duration: payload.duration ?? null,
      from_position: payload.from_position ?? null,
    });

    if (!error) {
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
 * The update is scoped by session id, private capability, and viewer identity,
 * and is idempotent for an already-ended session.
 */
export async function endWatchSession(
  sessionId: string,
  sessionToken: string,
  viewerIdentity: string,
  watchTimeSeconds: number,
  completionPercentage: number
): Promise<boolean> {
  if (!sessionId || !sessionToken) return false;

  try {
    if (!(await isAuthorizedWatchSession(sessionId, sessionToken, viewerIdentity))) return false;

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
      .is("ended_at", null)
      .select("id")
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}
