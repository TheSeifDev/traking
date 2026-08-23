/**
 * Tracking Domain Service
 *
 * Handles private viewer watch-session lifecycle and event recording.
 * The session capability token is returned only to the viewer and is required for
 * subsequent event and end-session writes. The stable viewer identifier is a
 * one-way hash of either the TrackUp profile id or the scoped guest identity id.
 */
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import type { TrackingEventPayload, TrackingEventType } from "@/src/types/tracking";
import type { WatchActor } from "@/src/lib/tracking/viewer-identity";

export interface ViewerClientMetadata {
  device_type: string | null;
  browser: string | null;
  os: string | null;
}

export function deriveViewerClientMetadata(userAgent: string | null): ViewerClientMetadata {
  const ua = userAgent?.toLowerCase() ?? "";
  const device_type = /mobile|iphone|android.*mobile/.test(ua) ? "mobile" : /tablet|ipad|android/.test(ua) ? "tablet" : ua ? "desktop" : null;
  const browser = /edg\//.test(ua) ? "Edge" : /opr\//.test(ua) ? "Opera" : /chrome\//.test(ua) ? "Chrome" : /firefox\//.test(ua) ? "Firefox" : /safari\//.test(ua) && !/chrome\//.test(ua) ? "Safari" : /msie|trident\//.test(ua) ? "Internet Explorer" : null;
  const os = /windows/.test(ua) ? "Windows" : /mac os|macintosh/.test(ua) ? "macOS" : /android/.test(ua) ? "Android" : /iphone|ipad|ios/.test(ua) ? "iOS" : /linux/.test(ua) ? "Linux" : null;
  return { device_type, browser, os };
}

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
    const { data: link, error: linkError } = await supabase
      .from("watch_links")
      .select("id, expires_at, revoked_at, video_id")
      .eq("token", token)
      .maybeSingle();

    if (linkError) {
      console.error("watch_link_lookup_failed", { code: linkError.code, message: linkError.message });
      return null;
    }
    if (!link) {
      console.info("watch_link_not_found");
      return null;
    }
    if (link.revoked_at) return null;
    if (link.expires_at && new Date(link.expires_at) <= new Date()) return null;

    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("id, title, source_type, source_url, duration")
      .eq("id", link.video_id)
      .maybeSingle();
    if (videoError) {
      console.error("watch_link_video_lookup_failed", { code: videoError.code, message: videoError.message });
      return null;
    }
    if (!video) {
      console.warn("watch_link_video_missing", { watchLinkId: link.id });
      return null;
    }

    return {
      watch_link_id: link.id,
      video_id: video.id,
      title: video.title,
      source_type: video.source_type,
      source_url: video.source_url,
      duration: video.duration ?? null,
    };
  } catch (error) {
    console.error("watch_link_lookup_exception", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  }
}

/**
 * Creates a new private viewer watch session and returns its capability.
 * viewer_identifier is a stable one-way hash of the profile/guest identity — never raw PII.
 */
export async function createWatchSession(
  watchLinkId: string,
  actor: WatchActor,
  userAgent: string | null = null,
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

    const viewerIdentifier = actor.kind === "profile"
      ? await hashProfileIdentity(actor.profileId)
      : await hashGuestIdentity(actor.identityId);
    const viewerMetadata = deriveViewerClientMetadata(userAgent);

    const { data, error } = await supabase
      .from("watch_sessions")
      .insert({
        watch_link_id: watchLinkId,
        viewer_identifier: viewerIdentifier,
        viewer_profile_id: actor.kind === "profile" ? actor.profileId : null,
        viewer_identity_id: actor.kind === "guest" ? actor.identityId : null,
        device_type: viewerMetadata.device_type,
        browser: viewerMetadata.browser,
        os: viewerMetadata.os,
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
 * Checks the private capability and resolved viewer actor before allowing a session write.
 * This deliberately returns only a boolean so callers cannot distinguish an
 * unknown session id from a known id with a wrong capability.
 */
async function hashCanonicalViewerIdentity(identityKey: string): Promise<string> {
  const data = new TextEncoder().encode(identityKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashProfileIdentity(profileId: string): Promise<string> {
  return hashCanonicalViewerIdentity(`profile:${profileId}`);
}

async function hashGuestIdentity(identityId: string): Promise<string> {
  return hashCanonicalViewerIdentity(`guest:${identityId}`);
}

export async function isAuthorizedWatchSession(
  sessionId: string,
  sessionToken: string,
  actor: WatchActor,
): Promise<boolean> {
  if (!sessionId || !sessionToken) return false;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("watch_sessions")
      .select("id, watch_link_id, viewer_identifier, viewer_profile_id, viewer_identity_id")
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .is("ended_at", null)
      .maybeSingle();

    if (error || !data) return false;
    if (actor.kind === "profile") {
      return data.viewer_profile_id === actor.profileId && data.viewer_identifier === await hashProfileIdentity(actor.profileId);
    }
    return data.watch_link_id === actor.watchLinkId && data.viewer_identity_id === actor.identityId && data.viewer_identifier === await hashGuestIdentity(actor.identityId);
  } catch {
    return false;
  }
}

/**
 * Records one or more tracking events for an authorized private viewer session.
 * Client ids make retries safe and sequence/occurred_at preserve playback order.
 */
export async function recordTrackingEvents(
  sessionId: string,
  sessionToken: string,
  events: TrackingEventPayload[],
  actor: WatchActor,
): Promise<boolean> {
  if (!sessionId || !sessionToken || events.length === 0) return false;
  if (!(await isAuthorizedWatchSession(sessionId, sessionToken, actor))) return false;

  try {
    const supabase = createAdminClient();
    const rows = events.map((event) => ({
      session_id: sessionId,
      event_type: event.event_type as TrackingEventType,
      position: Math.max(0, Number.isFinite(event.position) ? event.position : 0),
      duration: event.duration !== null && event.duration !== undefined && Number.isFinite(event.duration) && event.duration > 0 ? event.duration : null,
      from_position: event.from_position !== null && event.from_position !== undefined && Number.isFinite(event.from_position) ? Math.max(0, event.from_position) : null,
      client_event_id: event.client_event_id ?? null,
      sequence_number: event.sequence_number ?? null,
      occurred_at: event.occurred_at ?? null,
      metadata: event.metadata ?? {},
    }));
    const { error } = await supabase.from("watch_events").upsert(rows, { onConflict: "session_id,client_event_id", ignoreDuplicates: true });
    if (error) return false;

    const { error: sessionUpdateError } = await supabase
      .from("watch_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .is("ended_at", null);
    return !sessionUpdateError;
  } catch {
    return false;
  }
}

export async function recordTrackingEvent(
  payload: TrackingEventPayload,
  actor: WatchActor,
): Promise<boolean> {
  return recordTrackingEvents(payload.session_id, payload.session_token, [payload], actor);
}

/**
 * Ends a watch session, recording final watch time and completion %.
 * The update is scoped by session id, private capability, and viewer identity,
 * and is idempotent for an already-ended session.
 */
export async function endWatchSession(
  sessionId: string,
  sessionToken: string,
  actor: WatchActor,
  watchTimeSeconds: number,
  completionPercentage: number,
  position: number | null = null,
  duration: number | null = null,
  finalEvent: { client_event_id?: string | null; sequence_number?: number | null; occurred_at?: string | null } = {},
): Promise<boolean> {
  if (!sessionId || !sessionToken) return false;

  try {
    if (!(await isAuthorizedWatchSession(sessionId, sessionToken, actor))) return false;

    const supabase = createAdminClient();
    if (position !== null || duration !== null) {
      const { error: eventError } = await supabase.from("watch_events").insert({
        session_id: sessionId,
        event_type: "ended",
        position: position ?? 0,
        duration: duration ?? null,
        from_position: null,
        client_event_id: finalEvent.client_event_id ?? null,
        sequence_number: finalEvent.sequence_number ?? null,
        occurred_at: finalEvent.occurred_at ?? null,
        metadata: {},
      });
      if (eventError) return false;
    }

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
