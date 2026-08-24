/**
 * Video Domain Service
 *
 * All video operations go through this module.
 * Authorization is enforced: all queries are scoped to the caller's workspace.
 * Uses the admin (service-role) client so RLS policies don't block service reads.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import { isValidSourceType, type Video, type CreateVideoInput, type UpdateVideoInput, type VideoAnalytics, type WorkspaceAnalytics, type ViewerAnalytics, type ViewerVideoAnalytics, type WatchSessionSummary, type AnalyticsViewerSummary, type WatchEventType } from "@/src/types/video";
import type { Database } from "@/src/types/database";
import { getAppUrl } from "@/src/lib/app-url";
import { buildPlaybackHeatmap, aggregateHeatmaps, type PlaybackHeatmap } from "@/src/lib/analytics/ranges";
import type { AnalyticsDataScope, VideoDataScope } from "@/src/lib/spaces/data-scope";
import { providerScope, providerSupportsDetailedTelemetry } from "@/src/lib/playback/providers";

interface AnalyticsSessionRow {
  id: string;
  watch_link_id: string;
  viewer_identifier: string | null;
  viewer_profile_id: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  profiles?: unknown;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  watch_time_seconds: number;
  completion_percentage: number;
  watch_links?: unknown;
}

interface AnalyticsEventRow {
  id: string;
  session_id: string;
  event_type: VideoAnalytics["viewer_sessions"][number]["playback_events"][number]["event_type"];
  position: number;
  duration: number | null;
  from_position: number | null;
  client_event_id: string | null;
  sequence_number: number | null;
  occurred_at: string | null;
  playback_rate: number | null;
  from_rate: number | null;
  to_rate: number | null;
  metadata: Record<string, string | number | boolean | null>;
  received_at: string;
  created_at: string;
}

type GeneratedWatchLink = {
  id: string;
  token: string;
  created_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  url: string;
  reused: boolean;
};

function firstRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? first as Record<string, unknown> : null;
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

type AnalyticsVideoInfo = { id: string; space_id?: string | null; title: string; source_type: Video["source_type"]; duration: number | null };

export function supportsPlaybackMetrics(sourceType: Video["source_type"]): boolean {
  return providerSupportsDetailedTelemetry(sourceType);
}

const PLAYBACK_TELEMETRY_EVENTS: readonly WatchEventType[] = [
  "play",
  "resume",
  "pause",
  "seek",
  "seek_started",
  "seek_completed",
  "heartbeat",
  "playback_progress",
  "complete",
  "ended",
];

export type ReliablePlaybackEventEvidence = {
  event_type: string;
  position: number | null;
  duration: number | null;
};

export function isReliablePlaybackEvent(event: ReliablePlaybackEventEvidence): boolean {
  return PLAYBACK_TELEMETRY_EVENTS.includes(event.event_type as WatchEventType)
    && Number.isFinite(event.position)
    && (event.position ?? -1) >= 0
    && event.duration !== null
    && Number.isFinite(event.duration)
    && (event.duration ?? 0) > 0;
}

export function hasReliablePlaybackTelemetry(
  sourceType: Video["source_type"],
  events: ReliablePlaybackEventEvidence[],
): boolean {
  if (!supportsPlaybackMetrics(sourceType)) return false;
  const hasPlaybackStart = events.some((event) =>
    (event.event_type === "play" || event.event_type === "resume")
    && Number.isFinite(event.position)
    && (event.position ?? -1) >= 0,
  );
  return hasPlaybackStart && events.some(isReliablePlaybackEvent);
}

function isValidTelemetryEvent(event: AnalyticsEventRow): boolean {
  return PLAYBACK_TELEMETRY_EVENTS.includes(event.event_type)
    && Number.isFinite(event.position)
    && event.position >= 0
    && event.duration !== null
    && Number.isFinite(event.duration)
    && event.duration > 0;
}

function profileFromRelation(value: unknown): { id: string; name: string | null; email: string | null; is_active: boolean } | null {
  const relation = firstRelation(value);
  if (!relation || typeof relation.id !== "string" || typeof relation.email !== "string") return null;
  return {
    id: relation.id,
    name: typeof relation.name === "string" ? relation.name : null,
    email: relation.email,
    is_active: relation.is_active !== false,
  };
}

function telemetryState(sourceType: Video["source_type"], hasTelemetry: boolean): "measured" | "missing" | "unsupported" {
  if (!supportsPlaybackMetrics(sourceType)) return "unsupported";
  return hasTelemetry ? "measured" : "missing";
}

async function attachSessionProfiles(
  supabase: ReturnType<typeof createAdminClient>,
  sessions: AnalyticsSessionRow[],
): Promise<void> {
  const profileIds = Array.from(new Set(sessions.map((session) => session.viewer_profile_id).filter((id): id is string => Boolean(id))));
  if (profileIds.length === 0) return;
  const { data } = await supabase.from("profiles").select("id, name, email, is_active").in("id", profileIds);
  const profilesById = new Map((data ?? []).map((profile) => [profile.id, profile]));
  for (const session of sessions) session.profiles = session.viewer_profile_id ? profilesById.get(session.viewer_profile_id) ?? null : null;
}

function effectiveWatchTime(session: VideoAnalytics["viewer_sessions"][number]): number | null {
  if (!session.has_playback_telemetry) return null;
  if (session.heatmap?.available) return Math.round(session.heatmap.ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0));
  return session.watch_time_seconds;
}

function buildViewerSummaries(sessions: VideoAnalytics["viewer_sessions"]): AnalyticsViewerSummary[] {
  const grouped = new Map<string, VideoAnalytics["viewer_sessions"]>();
  for (const session of sessions) {
    const key = session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }
  return Array.from(grouped.entries()).map(([key, viewerSessions]) => {
    const measured = viewerSessions.filter((session) => session.has_playback_telemetry);
    const watchTimes = measured.map(effectiveWatchTime).filter((value): value is number => value !== null);
    const completions = measured.map((session) => session.completion_percentage).filter((value): value is number => value !== null);
    const latest = viewerSessions.slice().sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())[0];
    const measuredCount = measured.length;
    return {
      viewer_id: key,
      viewer_identifier: latest.viewer_identifier,
      viewer_name: latest.viewer_name ?? null,
      viewer_email: latest.viewer_email ?? null,
      viewer_status: latest.viewer_status ?? "anonymous",
      viewer_is_active: latest.viewer_is_active ?? null,
      first_seen_at: viewerSessions.reduce((min, session) => !min || session.started_at < min ? session.started_at : min, null as string | null),
      last_seen_at: latest.last_activity_at,
      total_sessions: viewerSessions.length,
      total_watch_time_seconds: watchTimes.length > 0 ? watchTimes.reduce((sum, value) => sum + value, 0) : null,
      avg_watch_time_seconds: watchTimes.length > 0 ? Math.round(watchTimes.reduce((sum, value) => sum + value, 0) / watchTimes.length) : null,
      avg_completion_percentage: completions.length > 0 ? Math.round(completions.reduce((sum, value) => sum + value, 0) / completions.length) : null,
      last_position: latest.last_position,
      videos_watched: new Set(viewerSessions.map((session) => session.video_id)).size,
      device_type: latest.device_type ?? null,
      browser: latest.browser ?? null,
      os: latest.os ?? null,
      telemetry_state: measuredCount > 0 ? ("measured" as const) : viewerSessions.every((session) => session.telemetry_state === "unsupported") ? ("unsupported" as const) : ("missing" as const),
    };
  }).sort((a, b) => new Date(b.last_seen_at ?? 0).getTime() - new Date(a.last_seen_at ?? 0).getTime());
}

function buildViewerSessionAnalytics(
  sessions: AnalyticsSessionRow[],
  events: AnalyticsEventRow[],
  videosBySession: Map<string, AnalyticsVideoInfo>,
): VideoAnalytics["viewer_sessions"] {
  const sessionsByViewer = new Map<string, AnalyticsSessionRow[]>();
  for (const session of sessions) {
    const key = session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.id}`;
    const group = sessionsByViewer.get(key) ?? [];
    group.push(session);
    sessionsByViewer.set(key, group);
  }

  const eventsBySession = new Map<string, AnalyticsEventRow[]>();
  for (const event of events) {
    const group = eventsBySession.get(event.session_id) ?? [];
    group.push(event);
    eventsBySession.set(event.session_id, group);
  }

  const eventTime = (event: AnalyticsEventRow): number => {
    const occurred = event.occurred_at ? new Date(event.occurred_at).getTime() : Number.NaN;
    if (Number.isFinite(occurred)) return occurred;
    const received = new Date(event.received_at).getTime();
    return Number.isFinite(received) ? received : new Date(event.created_at).getTime();
  };
  const sortEvents = (eventList: AnalyticsEventRow[]) => eventList.slice().sort((a, b) => {
    if (a.sequence_number !== null && a.sequence_number !== undefined && b.sequence_number !== null && b.sequence_number !== undefined && a.sequence_number !== b.sequence_number) return a.sequence_number - b.sequence_number;
    return eventTime(a) - eventTime(b);
  });

  return sessions
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .flatMap((session) => {
      const video = videosBySession.get(session.id);
      if (!video) return [];
      const scope = providerScope(video.source_type);
      const viewerKey = session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.id}`;
      const viewerSessions = (sessionsByViewer.get(viewerKey) ?? [])
        .slice()
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
      const sessionNumber = viewerSessions.findIndex((item) => item.id === session.id) + 1;
      const sessionEvents = sortEvents(eventsBySession.get(session.id) ?? []);
      const playbackEvents = sessionEvents.map((event) => ({
        id: event.id,
        event_type: event.event_type,
        position: Number(event.position ?? 0),
        from_position: event.from_position === null ? null : Number(event.from_position),
        duration: event.duration === null ? null : Number(event.duration),
        created_at: event.created_at,
        sequence_number: event.sequence_number,
        occurred_at: event.occurred_at,
        received_at: event.received_at,
        playback_rate: event.playback_rate,
        from_rate: event.from_rate,
        to_rate: event.to_rate,
        metadata: event.metadata,
      }));
      const validTelemetryEvents = sessionEvents.filter(isValidTelemetryEvent);
      const telemetryEventCount = validTelemetryEvents.length;
      const hasPlaybackStart = sessionEvents.some((event) => (event.event_type === "play" || event.event_type === "resume") && Number.isFinite(event.position) && event.position >= 0);
      const hasPlaybackTelemetry = supportsPlaybackMetrics(video.source_type) && hasPlaybackStart && telemetryEventCount > 0;
      const firstPlay = sessionEvents.find((event) => (event.event_type === "play" || event.event_type === "resume") && Number.isFinite(event.position) && event.position >= 0);
      const latestEvent = sessionEvents[sessionEvents.length - 1];
      const latestTelemetryEvent = sessionEvents.slice().reverse().find(isValidTelemetryEvent);
      const latestDurationEvent = sessionEvents.slice().reverse().find((event) => isValidTelemetryEvent(event));
      const latestEventTime = latestEvent ? eventTime(latestEvent) : 0;
      const lastActivityAt = latestEvent && latestEventTime > new Date(session.last_seen_at).getTime()
        ? latestEvent.occurred_at ?? latestEvent.created_at
        : session.last_seen_at;
      const lastPosition = hasPlaybackTelemetry && latestTelemetryEvent ? Number(latestTelemetryEvent.position ?? 0) : null;
      const lastDuration = hasPlaybackTelemetry && latestDurationEvent?.duration !== null && latestDurationEvent?.duration !== undefined
        ? Number(latestDurationEvent.duration)
        : null;
      const reachedPercentage = hasPlaybackTelemetry
        ? Math.min(100, Math.max(0, Number(session.completion_percentage ?? 0)))
        : null;
      const profile = profileFromRelation(session.profiles);
      const heatmap = buildPlaybackHeatmap(playbackEvents, video.duration ?? lastDuration, supportsPlaybackMetrics(video.source_type));

      return {
        session_id: session.id,
        viewer_identifier: session.viewer_identifier,
        viewer_profile_id: session.viewer_profile_id,
        viewer_name: profile?.name ?? null,
        viewer_email: profile?.email ?? null,
        viewer_status: profile ? "identified" as const : "anonymous" as const,
        viewer_is_active: profile?.is_active ?? null,
        video_id: video.id,
        space_id: video.space_id ?? null,
        video_title: video.title,
        source_type: video.source_type,
        session_number: sessionNumber,
        session_count_for_viewer: viewerSessions.length,
        started_at: session.started_at,
        first_play_at: hasPlaybackTelemetry ? firstPlay ? firstPlay.occurred_at ?? firstPlay.created_at : null : null,
        last_activity_at: lastActivityAt,
        ended_at: session.ended_at,
        watch_time_seconds: hasPlaybackTelemetry ? Math.max(0, heatmap.available ? Math.round(heatmap.ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0)) : Number(session.watch_time_seconds ?? 0)) : null,
        completion_percentage: reachedPercentage,
        playback_events: playbackEvents,
        last_position: hasPlaybackTelemetry ? lastPosition : null,
        last_duration: hasPlaybackTelemetry ? lastDuration : null,
        playback_metrics_scope: scope,
        has_playback_telemetry: hasPlaybackTelemetry,
        telemetry_event_count: telemetryEventCount,
        device_type: session.device_type,
        browser: session.browser,
        os: session.os,
        telemetry_state: telemetryState(video.source_type, hasPlaybackTelemetry),
        heatmap,
      };
    });
}

/**
 * Lists all videos for a workspace, with view counts.
 */
export async function listVideos(scope: VideoDataScope): Promise<Video[]> {
  try {
    const supabase = createAdminClient();
    let videoQuery = supabase
      .from("videos")
      .select(`
        *,
        video_clickup_tasks(*),
        watch_links(
          id,
          token,
          created_by,
          expires_at,
          revoked_at,
          created_at,
          watch_sessions(id, viewer_identifier, viewer_profile_id, started_at, last_seen_at, completion_percentage)
        )
      `)
      .eq("workspace_id", scope.workspaceId);
    if (scope.type === "space") videoQuery = videoQuery.eq("space_id", scope.spaceId);
    if (scope.type === "organization") {
      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", scope.organizationId)
        .eq("clickup_workspace_id", scope.workspaceId)
        .maybeSingle();
      if (organizationError || !organization) return [];
    }
    const { data, error } = await videoQuery.order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to list videos", error);
      throw new Error("video_list_failed");
    }
    if (!data) return [];

    return data.map((v) => {
      const rawWatchLinks = (v.watch_links ?? []) as Array<{
        id: string;
        token: string;
        created_by: string | null;
        expires_at: string | null;
        revoked_at: string | null;
        created_at: string;
        watch_sessions?: Array<{
          id: string;
          viewer_identifier: string | null;
          viewer_profile_id: string | null;
          started_at: string;
          last_seen_at: string;
          completion_percentage: number;
        }>;
      }>;
      const sessions = rawWatchLinks.flatMap((watchLink) => watchLink.watch_sessions ?? []);
      const uniqueViewerCount = new Set(sessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? session.id)).size;

      return {
        ...v,
        source_type: v.source_type as Video["source_type"],
        view_count: sessions.length,
        unique_viewer_count: uniqueViewerCount,
        // Library listing deliberately does not infer completion from session columns;
        // canonical analytics computes it only from reliable provider events.
        avg_completion: null,
        clickup_tasks: v.video_clickup_tasks,
        watch_links: rawWatchLinks.map(({ watch_sessions: linkSessions = [], ...link }) => {
          const orderedSessions = [...linkSessions].sort(
            (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
          );
          const lastSession = [...linkSessions].sort(
            (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
          )[0];
          return {
            ...link,
            video_id: v.id,
            session_count: linkSessions.length,
            unique_viewer_count: new Set(linkSessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? session.id)).size,
            first_opened_at: orderedSessions[0]?.started_at ?? null,
            last_accessed_at: lastSession?.last_seen_at ?? null,
          };
        }),
      };
    });
  } catch (error) {
    console.error("Failed to list videos", error);
    throw new Error("video_list_failed");
  }
}

/**
 * Fetches a single video, verifying workspace ownership.
 * Returns null if not found or not in the workspace.
 */
export async function getVideo(videoId: string, scope: VideoDataScope): Promise<Video | null> {
  try {
    const supabase = createAdminClient();
    let videoQuery = supabase
      .from("videos")
      .select(`
        *,
        video_clickup_tasks(*),
        watch_links(id, token, created_by, expires_at, revoked_at, created_at)
      `)
      .eq("id", videoId)
      .eq("workspace_id", scope.workspaceId);
    if (scope.type === "space") videoQuery = videoQuery.eq("space_id", scope.spaceId);
    if (scope.type === "organization") {
      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", scope.organizationId)
        .eq("clickup_workspace_id", scope.workspaceId)
        .maybeSingle();
      if (organizationError || !organization) return null;
    }
    const { data, error } = await videoQuery.maybeSingle();

    if (error || !data) return null;

    return {
      ...data,
      source_type: data.source_type as Video["source_type"],
      clickup_tasks: data.video_clickup_tasks,
      watch_links: data.watch_links?.map((wl: { id: string; token: string; created_by: string | null; expires_at: string | null; revoked_at: string | null; created_at: string }) => ({
        ...wl,
        video_id: data.id,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Creates a new video in a workspace.
 */
export async function createVideo(
  workspaceId: string,
  createdBy: string,
  input: CreateVideoInput,
  spaceId?: string,
): Promise<Video | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("videos")
      .insert({
        workspace_id: workspaceId,
        space_id: spaceId ?? null,
        created_by: createdBy,
        title: input.title.trim(),
        description: input.description ?? null,
        source_type: input.source_type,
        source_url: input.source_url.trim(),
        duration: input.duration ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Failed to create video", error);
      return null;
    }

    return { ...data, source_type: data.source_type as Video["source_type"] };
  } catch {
    return null;
  }
}

/**
 * Updates an existing video. Enforces workspace ownership.
 */
export async function updateVideo(
  videoId: string,
  workspaceId: string,
  input: UpdateVideoInput,
  spaceId?: string,
): Promise<Video | null> {
  try {
    const supabase = createAdminClient();

    const updateData: UpdateVideoInput = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description;
    if (input.source_type !== undefined) updateData.source_type = input.source_type;
    if (input.source_url !== undefined) updateData.source_url = input.source_url.trim();
    if (input.duration !== undefined) updateData.duration = input.duration;

    let updateQuery = supabase
      .from("videos")
      .update(updateData as Database["public"]["Tables"]["videos"]["Update"])
      .eq("id", videoId)
      .eq("workspace_id", workspaceId);
    if (spaceId) updateQuery = updateQuery.eq("space_id", spaceId);
    const { data, error } = await updateQuery.select().single();

    if (error || !data) return null;
    return { ...data, source_type: data.source_type as Video["source_type"] };
  } catch {
    return null;
  }
}

/**
 * Deletes a video. Enforces workspace ownership.
 * Cascades to watch_links, watch_sessions, watch_events.
 */
export async function deleteVideo(videoId: string, workspaceId: string, spaceId?: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    let deleteQuery = supabase
      .from("videos")
      .delete()
      .eq("id", videoId)
      .eq("workspace_id", workspaceId);
    if (spaceId) deleteQuery = deleteQuery.eq("space_id", spaceId);
    const { error } = await deleteQuery;

    return !error;
  } catch {
    return false;
  }
}

/**
 * Generates a watch link for a video.
 * The token is generated by the DB (base64url of 24 random bytes).
 */
export async function generateWatchLink(
  videoId: string,
  workspaceId: string,
  createdBy: string,
  spaceId?: string,
): Promise<GeneratedWatchLink | null> {
  try {
    const supabase = createAdminClient();

    // Verify ownership first.
    let videoQuery = supabase
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId);
    if (spaceId) videoQuery = videoQuery.eq("space_id", spaceId);
    const { data: video } = await videoQuery.maybeSingle();

    if (!video) return null;

    const selectFields = "id, token, created_by, expires_at, revoked_at, created_at";
    const appUrl = getAppUrl();
    const toResult = (link: {
      id: string;
      token: string;
      created_by: string | null;
      expires_at: string | null;
      revoked_at: string | null;
      created_at: string;
    }, reused: boolean): GeneratedWatchLink => ({
      ...link,
      url: `${appUrl}/watch/${link.token}`,
      reused,
    });

    // Repeated requests return the same active TrackUp viewer link.
    const { data: activeLink, error: activeLinkError } = await supabase
      .from("watch_links")
      .select(selectFields)
      .eq("video_id", videoId)
      .is("revoked_at", null)
      .maybeSingle();

    if (activeLinkError) {
      console.error("Failed to find active watch link", activeLinkError);
      return null;
    }
    if (activeLink) return toResult(activeLink, true);

    const { data, error } = await supabase
      .from("watch_links")
      .insert({ video_id: videoId, created_by: createdBy })
      .select(selectFields)
      .single();

    if (!error && data) return toResult(data, false);

    // The partial unique index closes the race between concurrent creators.
    if (error?.code === "23505") {
      const { data: racedLink } = await supabase
        .from("watch_links")
        .select(selectFields)
        .eq("video_id", videoId)
        .is("revoked_at", null)
        .maybeSingle();
      if (racedLink) return toResult(racedLink, true);
    }

    console.error("Failed to generate watch link", error);
    return null;
  } catch {
    return null;
  }
}

/**
 * Revokes a watch link after verifying that its video belongs to the workspace.
 * Existing analytics remain available; only future public sessions are blocked.
 */
export async function revokeWatchLink(
  linkId: string,
  videoId: string,
  workspaceId: string,
  spaceId?: string,
): Promise<boolean> {
  if (!linkId || !videoId || !workspaceId) return false;

  try {
    const supabase = createAdminClient();
    let videoQuery = supabase
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId);
    if (spaceId) videoQuery = videoQuery.eq("space_id", spaceId);
    const { data: video } = await videoQuery.maybeSingle();
    if (!video) return false;

    const { data, error } = await supabase
      .from("watch_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("video_id", videoId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Returns aggregated analytics for a single video.
 * Only reads sessions/events via the service-role client.
 */
export async function getVideoAnalytics(
  videoId: string,
  scope: VideoDataScope,
): Promise<VideoAnalytics | null> {
  try {
    const supabase = createAdminClient();

    let videoQuery = supabase
      .from("videos")
      .select("id, title, duration, source_type")
      .eq("id", videoId)
      .eq("workspace_id", scope.workspaceId);
    if (scope.type === "space") videoQuery = videoQuery.eq("space_id", scope.spaceId);
    if (scope.type === "organization") {
      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", scope.organizationId)
        .eq("clickup_workspace_id", scope.workspaceId)
        .maybeSingle();
      if (organizationError || !organization) return null;
    }
    const { data: video } = await videoQuery.maybeSingle();

    if (!video) return null;

    const { data: rawSessions, error: sessionsError } = await supabase
      .from("watch_sessions")
      .select(`
        id,
        watch_link_id,
        viewer_identifier,
        viewer_profile_id,
        device_type,
        browser,
        os,
        started_at,
        last_seen_at,
        ended_at,
        watch_time_seconds,
        completion_percentage,
        watch_links!inner(video_id)
      `)
      .eq("watch_links.video_id", videoId)
      .order("started_at", { ascending: false })
      .limit(500);

    if (sessionsError) return null;

    const sessions = (rawSessions ?? []) as unknown as AnalyticsSessionRow[];
    await attachSessionProfiles(supabase, sessions);
    const sessionIds = sessions.map((session) => session.id);
    let events: AnalyticsEventRow[] = [];
    if (sessionIds.length > 0) {
      const { data: rawEvents, error: eventsError } = await supabase
        .from("watch_events")
        .select("id, session_id, event_type, position, duration, from_position, client_event_id, sequence_number, occurred_at, playback_rate, from_rate, to_rate, metadata, received_at, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (eventsError) return null;
      events = (rawEvents ?? []) as unknown as AnalyticsEventRow[];
    }

    const totalViews = sessions.length;
    const uniqueViewers = new Set(sessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? session.id)).size;
    const playbackMetricsScope = providerScope(video.source_type);
    const videoInfo: AnalyticsVideoInfo = {
      id: video.id,
      title: video.title,
      source_type: video.source_type as Video["source_type"],
      duration: video.duration ?? null,
    };
    const viewerSessions = buildViewerSessionAnalytics(
      sessions,
      events,
      new Map(sessions.map((session) => [session.id, videoInfo])),
    );
    const measuredSessions = viewerSessions.filter((session) => session.has_playback_telemetry);
    const measuredCount = measuredSessions.length;

    const totalMeasurableWatchTime = measuredCount > 0
      ? Math.round(measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0))
      : null;
    const avgWatchTime = measuredCount > 0
      ? Math.round((totalMeasurableWatchTime ?? 0) / measuredCount)
      : null;
    const avgCompletion = measuredCount > 0
      ? Math.round(measuredSessions.reduce((sum, session) => sum + Number(session.completion_percentage ?? 0), 0) / measuredCount)
      : null;
    const completionRate = measuredCount > 0
      ? Math.round((measuredSessions.filter((session) => Number(session.completion_percentage) >= 90).length / measuredCount) * 100)
      : null;

    const incompleteSessions = measuredSessions.filter((session) => Number(session.completion_percentage) < 90);
    let dropOffPoint: number | null = null;
    if (incompleteSessions.length > 0 && video.duration) {
      const avgDropPct = incompleteSessions.reduce((sum, session) => sum + Number(session.completion_percentage), 0) / incompleteSessions.length;
      dropOffPoint = Math.round((avgDropPct / 100) * video.duration);
    }

    const recentSessions: WatchSessionSummary[] = sessions.slice(0, 10).map((session) => ({
      id: session.id,
      viewer_identifier: session.viewer_identifier,
      started_at: session.started_at,
      ended_at: session.ended_at,
      watch_time_seconds: session.watch_time_seconds,
      completion_percentage: session.completion_percentage,
    }));

    return {
      video_id: videoId,
      total_views: totalViews,
      total_sessions: totalViews,
      unique_viewers: uniqueViewers,
      playback_metrics_scope: playbackMetricsScope,
      total_measurable_watch_time_seconds: totalMeasurableWatchTime,
      avg_watch_time_seconds: avgWatchTime,
      avg_completion_percentage: avgCompletion,
      completion_rate: completionRate,
      drop_off_point: dropOffPoint,
      last_activity_at: viewerSessions.reduce<string | null>((latest, session) => {
        if (!latest || new Date(session.last_activity_at).getTime() > new Date(latest).getTime()) return session.last_activity_at;
        return latest;
      }, null),
      recent_sessions: recentSessions,
      viewer_sessions: viewerSessions,
      viewers: buildViewerSummaries(viewerSessions),
      heatmap: aggregateHeatmaps(viewerSessions.map((session) => session.heatmap).filter((heatmap): heatmap is PlaybackHeatmap => Boolean(heatmap)), video.duration ?? null, supportsPlaybackMetrics(video.source_type)),
      telemetry_health: {
        measured_sessions: viewerSessions.filter((session) => session.telemetry_state === "measured").length,
        missing_sessions: viewerSessions.filter((session) => session.telemetry_state === "missing").length,
        unsupported_sessions: viewerSessions.filter((session) => session.telemetry_state === "unsupported").length,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Associates a ClickUp task with a video. Idempotent.
 */
export async function associateClickUpTask(
  videoId: string,
  workspaceId: string,
  clickupTaskId: string,
  clickupTaskName?: string,
  spaceId?: string,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Verify ownership
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (video && spaceId) {
      const { data: scopedVideo } = await supabase
        .from("videos")
        .select("id")
        .eq("id", videoId)
        .eq("space_id", spaceId)
        .maybeSingle();
      if (!scopedVideo) return false;
    }

    if (!video) return false;

    const { error } = await supabase
      .from("video_clickup_tasks")
      .upsert(
        { video_id: videoId, clickup_task_id: clickupTaskId, clickup_task_name: clickupTaskName ?? null },
        { onConflict: "video_id,clickup_task_id" }
      );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Workspace-level analytics summary.
 */
export async function getWorkspaceAnalytics(scope: AnalyticsDataScope, viewerProfileId?: string): Promise<WorkspaceAnalytics> {
  const empty: WorkspaceAnalytics = {
    total_videos: 0,
    total_views: 0,
    total_sessions: 0,
    unique_viewers: 0,
    total_measurable_watch_time_seconds: null,
    avg_watch_time_seconds: null,
    avg_completion_percentage: null,
    completion_rate: null,
    playback_metrics_available: false,
    activity_over_time: [],
    top_videos_by_views: [],
    top_videos_by_watch_time: [],
    recent_activity: [],
    viewer_sessions: [],
  };

  try {
    const supabase = createAdminClient();

    if (scope.type === "organization") {
      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", scope.organizationId)
        .eq("clickup_workspace_id", scope.workspaceId)
        .maybeSingle();
      if (organizationError || !organization) return empty;
    }

    let videoCountQuery = supabase
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", scope.workspaceId);
    if (scope.type === "space") videoCountQuery = videoCountQuery.eq("space_id", scope.spaceId);
    const { count: videoCount, error: videoCountError } = await videoCountQuery;
    if (videoCountError) return empty;

    const scopedSpaceIdSet = scope.type === "space" ? new Set([scope.spaceId]) : null;
    let sessionsQuery = supabase
      .from("watch_sessions")
      .select(`
        id,
        watch_link_id,
        viewer_identifier,
        viewer_profile_id,
        device_type,
        browser,
        os,
        started_at,
        last_seen_at,
        ended_at,
        watch_time_seconds,
        completion_percentage,
        watch_links!inner(
          video_id,
          videos!inner(id, title, workspace_id, space_id, source_type, duration)
        )
      `)
      .eq("watch_links.videos.workspace_id", scope.workspaceId);
    if (scope.type === "space") sessionsQuery = sessionsQuery.eq("watch_links.videos.space_id", scope.spaceId);
    if (viewerProfileId) sessionsQuery = sessionsQuery.eq("viewer_profile_id", viewerProfileId);
    const { data: rawSessions, error: sessionsError } = await sessionsQuery
      .order("started_at", { ascending: false })
      .limit(2000);
    if (sessionsError) return empty;

    const workspaceSessions: AnalyticsSessionRow[] = [];
    const sessionVideos = new Map<string, AnalyticsVideoInfo>();
    for (const raw of (rawSessions ?? []) as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as AnalyticsSessionRow;
      const link = firstRelation(row.watch_links);
      const relatedVideo = firstRelation(link?.videos);
      if (
        typeof relatedVideo?.id !== "string" ||
        typeof relatedVideo.title !== "string" ||
        !isValidSourceType(relatedVideo.source_type)
      ) continue;
      if (scopedSpaceIdSet && (typeof relatedVideo.space_id !== "string" || !scopedSpaceIdSet.has(relatedVideo.space_id))) continue;
      workspaceSessions.push(row);
      sessionVideos.set(row.id, {
        id: relatedVideo.id,
        space_id: typeof relatedVideo.space_id === "string" ? relatedVideo.space_id : null,
        title: relatedVideo.title,
        source_type: relatedVideo.source_type,
        duration: typeof relatedVideo.duration === "number" ? relatedVideo.duration : null,
      });
    }

    await attachSessionProfiles(supabase, workspaceSessions);
    const sessionIds = workspaceSessions.map((session) => session.id);
    let events: AnalyticsEventRow[] = [];
    if (sessionIds.length > 0) {
      const { data: rawEvents, error: eventsError } = await supabase
        .from("watch_events")
        .select("id, session_id, event_type, position, duration, from_position, client_event_id, sequence_number, occurred_at, playback_rate, from_rate, to_rate, metadata, received_at, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true })
        .limit(10000);
      if (eventsError) return empty;
      events = (rawEvents ?? []) as unknown as AnalyticsEventRow[];
    }

    const viewerSessions = buildViewerSessionAnalytics(workspaceSessions, events, sessionVideos);
    const totalViews = workspaceSessions.length;
    const uniqueViewers = new Set(workspaceSessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? session.id)).size;
    const measuredSessions = viewerSessions.filter((session) => session.has_playback_telemetry);
    const measuredSessionIds = new Set(measuredSessions.map((session) => session.session_id));
    const avgCompletion = measuredSessions.length > 0
      ? Math.round(measuredSessions.reduce((sum, session) => sum + Number(session.completion_percentage ?? 0), 0) / measuredSessions.length)
      : null;
    const completionRate = measuredSessions.length > 0
      ? Math.round((measuredSessions.filter((session) => Number(session.completion_percentage) >= 90).length / measuredSessions.length) * 100)
      : null;
    const totalMeasurableWatchTime = measuredSessions.length > 0
      ? Math.round(measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0))
      : null;
    const avgWatchTime = measuredSessions.length > 0
      ? Math.round((totalMeasurableWatchTime ?? 0) / measuredSessions.length)
      : null;

    const activityByDate = new Map<string, { date: string; views: number; sessions: number }>();
    for (const session of workspaceSessions) {
      const date = session.started_at.slice(0, 10);
      const point = activityByDate.get(date) ?? { date, views: 0, sessions: 0 };
      point.views += 1;
      point.sessions += 1;
      activityByDate.set(date, point);
    }

    const videoSummaries = new Map<string, {
      video_id: string;
      space_id: string | null;
      title: string;
      source_type: Video["source_type"];
      total_views: number;
      measurable_watch_time_seconds: number | null;
    }>();
    for (const session of workspaceSessions) {
      const video = sessionVideos.get(session.id);
      if (!video) continue;
      const summary = videoSummaries.get(video.id) ?? {
        video_id: video.id,
        space_id: video.space_id ?? null,
        title: video.title,
        source_type: video.source_type,
        total_views: 0,
        measurable_watch_time_seconds: null,
      };
      summary.total_views += 1;
      const normalizedSession = viewerSessions.find((item) => item.session_id === session.id);
      if (measuredSessionIds.has(session.id)) {
        summary.measurable_watch_time_seconds = (summary.measurable_watch_time_seconds ?? 0) + (normalizedSession?.watch_time_seconds ?? 0);
      }
      videoSummaries.set(video.id, summary);
    }

    const summaries = Array.from(videoSummaries.values());
    const topVideosByViews = summaries
      .slice()
      .sort((a, b) => b.total_views - a.total_views || a.title.localeCompare(b.title))
      .slice(0, 10);
    const topVideosByWatchTime = summaries
      .filter((summary) => summary.measurable_watch_time_seconds !== null)
      .slice()
      .sort((a, b) => (b.measurable_watch_time_seconds ?? 0) - (a.measurable_watch_time_seconds ?? 0) || a.title.localeCompare(b.title))
      .slice(0, 10);

    return {
      total_videos: videoCount ?? 0,
      total_views: totalViews,
      total_sessions: totalViews,
      unique_viewers: uniqueViewers,
      total_measurable_watch_time_seconds: totalMeasurableWatchTime,
      avg_watch_time_seconds: avgWatchTime,
      avg_completion_percentage: avgCompletion,
      completion_rate: completionRate,
      playback_metrics_available: measuredSessions.length > 0,
      activity_over_time: Array.from(activityByDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
      top_videos_by_views: topVideosByViews,
      top_videos_by_watch_time: topVideosByWatchTime,
      recent_activity: viewerSessions.slice(0, 10),
      viewer_sessions: viewerSessions,
      viewers: buildViewerSummaries(viewerSessions),
      telemetry_health: {
        measured_sessions: viewerSessions.filter((session) => session.telemetry_state === "measured").length,
        missing_sessions: viewerSessions.filter((session) => session.telemetry_state === "missing").length,
        unsupported_sessions: viewerSessions.filter((session) => session.telemetry_state === "unsupported").length,
      },
    };
  } catch {
    return empty;
  }
}

type ViewerVideoSourceInfo = AnalyticsVideoInfo & { source_url: string | null };

export async function getViewerAnalytics(
  viewerId: string,
  scope: VideoDataScope,
  videoId?: string,
): Promise<ViewerAnalytics | null> {
  if (!viewerId) return null;
  try {
    const supabase = createAdminClient();
    let allowedSpaceIds: Set<string> | null = null;
    if (scope.type === "organization") {
      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", scope.organizationId)
        .eq("clickup_workspace_id", scope.workspaceId)
        .maybeSingle();
      if (organizationError || !organization) return null;
      const { data: spaces, error: spacesError } = await supabase
        .from("spaces")
        .select("id")
        .eq("organization_id", scope.organizationId)
        .eq("clickup_workspace_id", scope.workspaceId)
        .is("archived_at", null)
        .limit(500);
      if (spacesError) return null;
      allowedSpaceIds = new Set((spaces ?? []).map((space) => space.id));
    } else {
      allowedSpaceIds = new Set([scope.spaceId]);
    }

    let sessionsQuery = supabase
      .from("watch_sessions")
      .select(`
        id,
        watch_link_id,
        viewer_identifier,
        viewer_profile_id,
        device_type,
        browser,
        os,
        started_at,
        last_seen_at,
        ended_at,
        watch_time_seconds,
        completion_percentage,
        watch_links!inner(
          video_id,
          videos!inner(id, title, source_url, workspace_id, space_id, source_type, duration)
        )
      `)
      .eq("watch_links.videos.workspace_id", scope.workspaceId);
    if (viewerId.match(/^[0-9a-f-]{36}$/i)) sessionsQuery = sessionsQuery.eq("viewer_profile_id", viewerId);
    else sessionsQuery = sessionsQuery.eq("viewer_identifier", viewerId);
    if (videoId) sessionsQuery = sessionsQuery.eq("watch_links.video_id", videoId);

    const { data: rawSessions, error: sessionsError } = await sessionsQuery
      .order("started_at", { ascending: false })
      .limit(2000);
    if (sessionsError) return null;

    const viewerSessionsRows: AnalyticsSessionRow[] = [];
    const sessionVideos = new Map<string, ViewerVideoSourceInfo>();
    const videosById = new Map<string, ViewerVideoSourceInfo>();
    for (const raw of (rawSessions ?? []) as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as AnalyticsSessionRow;
      const link = firstRelation(row.watch_links);
      const relatedVideo = firstRelation(link?.videos);
      if (
        typeof relatedVideo?.id !== "string" ||
        typeof relatedVideo.title !== "string" ||
        !isValidSourceType(relatedVideo.source_type) ||
        typeof relatedVideo.space_id !== "string" ||
        !allowedSpaceIds?.has(relatedVideo.space_id)
      ) continue;
      viewerSessionsRows.push(row);
      const videoInfo: ViewerVideoSourceInfo = {
        id: relatedVideo.id,
        space_id: relatedVideo.space_id,
        title: relatedVideo.title,
        source_type: relatedVideo.source_type,
        duration: typeof relatedVideo.duration === "number" ? relatedVideo.duration : null,
        source_url: typeof relatedVideo.source_url === "string" ? relatedVideo.source_url : null,
      };
      sessionVideos.set(row.id, videoInfo);
      videosById.set(videoInfo.id, videoInfo);
    }
    if (viewerSessionsRows.length === 0) return null;
    await attachSessionProfiles(supabase, viewerSessionsRows);

    const sessionIds = viewerSessionsRows.map((session) => session.id);
    const { data: rawEvents, error: eventsError } = await supabase
      .from("watch_events")
      .select("id, session_id, event_type, position, duration, from_position, client_event_id, sequence_number, occurred_at, playback_rate, from_rate, to_rate, metadata, received_at, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true })
      .limit(10000);
    if (eventsError) return null;

    const viewerSessions = buildViewerSessionAnalytics(
      viewerSessionsRows,
      (rawEvents ?? []) as unknown as AnalyticsEventRow[],
      new Map(Array.from(sessionVideos.entries()).map(([id, video]) => [id, video])),
    );
    if (viewerSessions.length === 0) return null;
    const viewer = buildViewerSummaries(viewerSessions).find((item) => item.viewer_id === viewerId) ?? buildViewerSummaries(viewerSessions)[0];
    if (!viewer) return null;

    const sessionsByVideo = new Map<string, VideoAnalytics["viewer_sessions"]>();
    for (const session of viewerSessions) sessionsByVideo.set(session.video_id, [...(sessionsByVideo.get(session.video_id) ?? []), session]);
    const videos: ViewerVideoAnalytics[] = Array.from(sessionsByVideo.entries()).flatMap(([videoId, sessions]) => {
      const video = videosById.get(videoId);
      if (!video) return [];
      const measuredSessions = sessions.filter((session) => session.has_playback_telemetry);
      const watchTimes = measuredSessions.map(effectiveWatchTime).filter((value): value is number => value !== null);
      const completions = measuredSessions.map((session) => session.completion_percentage).filter((value): value is number => value !== null);
      const duration = video.duration ?? sessions.map((session) => session.last_duration).find((value): value is number => value !== null) ?? null;
      const heatmap = aggregateHeatmaps(
        sessions.map((session) => session.heatmap).filter((value): value is PlaybackHeatmap => Boolean(value)),
        duration,
        supportsPlaybackMetrics(video.source_type),
      );
      const allEvents = sessions.flatMap((session) => session.playback_events);
      const latest = sessions.slice().sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())[0];
      const telemetryState = measuredSessions.length > 0
        ? "measured"
        : sessions.every((session) => session.telemetry_state === "unsupported")
          ? "unsupported"
          : "missing";
      return [{
        video_id: video.id,
        video_title: video.title,
        source_type: video.source_type,
        source_url: video.source_url,
        duration,
        total_sessions: sessions.length,
        measured_sessions: measuredSessions.length,
        session_only_sessions: sessions.filter((session) => session.telemetry_state === "unsupported").length,
        total_watch_time_seconds: watchTimes.length > 0 ? watchTimes.reduce((sum, value) => sum + value, 0) : null,
        unique_coverage_seconds: heatmap.available ? heatmap.ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0) : null,
        avg_watch_time_seconds: watchTimes.length > 0 ? Math.round(watchTimes.reduce((sum, value) => sum + value, 0) / watchTimes.length) : null,
        avg_completion_percentage: completions.length > 0 ? Math.round(completions.reduce((sum, value) => sum + value, 0) / completions.length) : null,
        best_completion_percentage: completions.length > 0 ? Math.max(...completions) : null,
        last_position: latest?.last_position ?? null,
        first_watched_at: sessions.reduce((earliest, session) => !earliest || session.started_at < earliest ? session.started_at : earliest, null as string | null),
        last_watched_at: latest?.last_activity_at ?? null,
        total_events: allEvents.length,
        play_count: allEvents.filter((event) => event.event_type === "play").length,
        pause_count: allEvents.filter((event) => event.event_type === "pause").length,
        resume_count: allEvents.filter((event) => event.event_type === "resume").length,
        seek_count: allEvents.filter((event) => event.event_type === "seek" || event.event_type === "seek_completed").length,
        buffering_count: allEvents.filter((event) => event.event_type === "buffer" || event.event_type === "buffering_started" || event.event_type === "buffering_ended").length,
        completion_count: allEvents.filter((event) => event.event_type === "complete").length,
        ended_count: allEvents.filter((event) => event.event_type === "ended" || event.event_type === "session_ended").length,
        progress_event_count: allEvents.filter((event) => event.event_type === "heartbeat" || event.event_type === "playback_progress").length,
        error_count: allEvents.filter((event) => event.event_type === "player_error").length,
        rewatch_count: Math.max(0, sessions.length - 1),
        watched_ranges: heatmap.ranges,
        heatmap,
        telemetry_state: telemetryState,
        sessions,
      }];
    });

    const orderedSessions = viewerSessions.slice().sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    const measuredSessions = viewerSessions.filter((session) => session.has_playback_telemetry);
    const watchTimes = measuredSessions.map(effectiveWatchTime).filter((value): value is number => value !== null);
    const completions = measuredSessions.map((session) => session.completion_percentage).filter((value): value is number => value !== null);
    const latest = viewerSessions.slice().sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())[0];
    return {
      viewer,
      videos: videos.sort((a, b) => new Date(b.last_watched_at ?? 0).getTime() - new Date(a.last_watched_at ?? 0).getTime()),
      sessions: viewerSessions,
      summary: {
        total_sessions: viewerSessions.length,
        videos_watched: videos.length,
        total_watch_time_seconds: watchTimes.length > 0 ? watchTimes.reduce((sum, value) => sum + value, 0) : null,
        average_completion_percentage: completions.length > 0 ? Math.round(completions.reduce((sum, value) => sum + value, 0) / completions.length) : null,
        first_seen_at: orderedSessions[0]?.started_at ?? null,
        last_seen_at: latest?.last_activity_at ?? null,
        device_type: latest?.device_type ?? null,
        browser: latest?.browser ?? null,
        os: latest?.os ?? null,
      },
    };
  } catch {
    return null;
  }
}

export async function getViewerVideoAnalytics(
  viewerId: string,
  videoId: string,
  scope: VideoDataScope,
): Promise<{ viewer: AnalyticsViewerSummary; video: ViewerVideoAnalytics } | null> {
  const analytics = await getViewerAnalytics(viewerId, scope, videoId);
  const video = analytics?.videos.find((item) => item.video_id === videoId);
  return analytics && video ? { viewer: analytics.viewer, video } : null;
}

export async function getVideoViewerAnalytics(
  videoId: string,
  scope: VideoDataScope,
  viewerId: string,
): Promise<{ video_id: string; video_title: string; source_type: Video["source_type"]; viewer: AnalyticsViewerSummary | null; sessions: VideoAnalytics["viewer_sessions"] } | null> {
  if (!viewerId) return null;
  const analytics = await getVideoAnalytics(videoId, scope);
  if (!analytics) return null;
  const sessions = analytics.viewer_sessions.filter((session) => {
    const sessionViewerId = session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`;
    return sessionViewerId === viewerId;
  });
  if (sessions.length === 0) return null;
  const viewer = analytics.viewers?.find((item) => item.viewer_id === viewerId) ?? buildViewerSummaries(sessions)[0] ?? null;
  return {
    video_id: analytics.video_id,
    video_title: sessions[0]?.video_title ?? "Video",
    source_type: sessions[0]?.source_type ?? "direct_url",
    viewer,
    sessions,
  };
}

export async function getVideoSessionAnalytics(
  videoId: string,
  scope: VideoDataScope,
  sessionId: string,
): Promise<VideoAnalytics["viewer_sessions"][number] | null> {
  if (!sessionId) return null;
  const analytics = await getVideoAnalytics(videoId, scope);
  return analytics?.viewer_sessions.find((session) => session.session_id === sessionId) ?? null;
}
