/**
 * Video Domain Service
 *
 * All video operations go through this module.
 * Authorization is enforced: all queries are scoped to the caller's workspace.
 * Uses the admin (service-role) client so RLS policies don't block service reads.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import { isValidSourceType, type Video, type CreateVideoInput, type UpdateVideoInput, type VideoAnalytics, type WorkspaceAnalytics, type WatchSessionSummary } from "@/src/types/video";
import type { Database } from "@/src/types/database";
import { getAppUrl } from "@/src/lib/app-url";

interface AnalyticsSessionRow {
  id: string;
  watch_link_id: string;
  viewer_identifier: string | null;
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

type AnalyticsVideoInfo = { id: string; title: string; source_type: Video["source_type"] };

function supportsPlaybackMetrics(sourceType: Video["source_type"]): boolean {
  return sourceType === "direct_url" || sourceType === "youtube";
}

function isValidTelemetryEvent(event: AnalyticsEventRow): boolean {
  return Number.isFinite(event.position)
    && event.position >= 0
    && event.duration !== null
    && Number.isFinite(event.duration)
    && event.duration > 0;
}

function buildViewerSessionAnalytics(
  sessions: AnalyticsSessionRow[],
  events: AnalyticsEventRow[],
  videosBySession: Map<string, AnalyticsVideoInfo>,
): VideoAnalytics["viewer_sessions"] {
  const sessionsByViewer = new Map<string, AnalyticsSessionRow[]>();
  for (const session of sessions) {
    const key = session.viewer_identifier ?? `anonymous:${session.id}`;
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

  return sessions
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .flatMap((session) => {
      const video = videosBySession.get(session.id);
      if (!video) return [];
      const scope = video.source_type === "direct_url"
        ? "direct_url_native_html5" as const
        : video.source_type === "youtube"
          ? "youtube_iframe_api" as const
          : "session_only" as const;
      const viewerKey = session.viewer_identifier ?? `anonymous:${session.id}`;
      const viewerSessions = (sessionsByViewer.get(viewerKey) ?? [])
        .slice()
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
      const sessionNumber = viewerSessions.findIndex((item) => item.id === session.id) + 1;
      const sessionEvents = (eventsBySession.get(session.id) ?? [])
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const telemetryEventCount = sessionEvents.filter(isValidTelemetryEvent).length;
      const hasPlaybackTelemetry = supportsPlaybackMetrics(video.source_type) && telemetryEventCount > 0;
      const firstPlay = sessionEvents.find((event) => event.event_type === "play" || event.event_type === "resume");
      const latestEvent = sessionEvents[sessionEvents.length - 1];
      const latestTelemetryEvent = sessionEvents.slice().reverse().find(isValidTelemetryEvent);
      const latestDurationEvent = sessionEvents.slice().reverse().find((event) => isValidTelemetryEvent(event));
      const lastActivityAt = latestEvent && new Date(latestEvent.created_at).getTime() > new Date(session.last_seen_at).getTime()
        ? latestEvent.created_at
        : session.last_seen_at;
      const lastPosition = hasPlaybackTelemetry && latestTelemetryEvent ? Number(latestTelemetryEvent.position ?? 0) : null;
      const lastDuration = hasPlaybackTelemetry && latestDurationEvent?.duration !== null && latestDurationEvent?.duration !== undefined
        ? Number(latestDurationEvent.duration)
        : null;
      const reachedPercentage = hasPlaybackTelemetry
        ? Math.min(100, Math.max(0, Number(session.completion_percentage ?? 0)))
        : null;

      return {
        session_id: session.id,
        viewer_identifier: session.viewer_identifier,
        video_id: video.id,
        video_title: video.title,
        source_type: video.source_type,
        session_number: sessionNumber,
        session_count_for_viewer: viewerSessions.length,
        started_at: session.started_at,
        first_play_at: hasPlaybackTelemetry ? firstPlay?.created_at ?? null : null,
        last_activity_at: lastActivityAt,
        ended_at: session.ended_at,
        watch_time_seconds: hasPlaybackTelemetry ? Number(session.watch_time_seconds ?? 0) : null,
        completion_percentage: reachedPercentage,
        playback_events: hasPlaybackTelemetry ? sessionEvents.map((event) => ({
          id: event.id,
          event_type: event.event_type,
          position: Number(event.position ?? 0),
          from_position: event.from_position === null ? null : Number(event.from_position),
          duration: event.duration === null ? null : Number(event.duration),
          created_at: event.created_at,
        })) : [],
        last_position: hasPlaybackTelemetry ? lastPosition : null,
        last_duration: hasPlaybackTelemetry ? lastDuration : null,
        playback_metrics_scope: scope,
        has_playback_telemetry: hasPlaybackTelemetry,
        telemetry_event_count: hasPlaybackTelemetry ? telemetryEventCount : 0,
      };
    });
}

/**
 * Lists all videos for a workspace, with view counts.
 */
export async function listVideos(workspaceId: string): Promise<Video[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
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
          watch_sessions(id, completion_percentage)
        )
      `)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to list videos", error);
      throw new Error("video_list_failed");
    }
    if (!data) return [];

    return data.map((v) => {
      const sessions = (v.watch_links as Array<{
        id: string;
        watch_sessions: Array<{ id: string; completion_percentage: number }>;
      }>)?.flatMap((wl) => wl.watch_sessions ?? []) ?? [];

      return {
        ...v,
        source_type: v.source_type as Video["source_type"],
        view_count: sessions.length,
        avg_completion:
          v.source_type === "direct_url" && sessions.length > 0
            ? Math.round(
                sessions.reduce((sum: number, s) => sum + Number(s.completion_percentage), 0) /
                  sessions.length
              )
            : null,
        clickup_tasks: v.video_clickup_tasks,
        watch_links: (v.watch_links as Array<{
        id: string;
        token: string;
        created_by: string | null;
        expires_at: string | null;
        revoked_at: string | null;
        created_at: string;
        watch_sessions: unknown[];
      }>)?.map(({ watch_sessions: _watchSessions, ...link }) => {
        void _watchSessions;
        return {
          ...link,
          video_id: v.id,
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
export async function getVideo(videoId: string, workspaceId: string): Promise<Video | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("videos")
      .select(`
        *,
        video_clickup_tasks(*),
        watch_links(id, token, created_by, expires_at, revoked_at, created_at)
      `)
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

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
  input: CreateVideoInput
): Promise<Video | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("videos")
      .insert({
        workspace_id: workspaceId,
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
  input: UpdateVideoInput
): Promise<Video | null> {
  try {
    const supabase = createAdminClient();

    const updateData: UpdateVideoInput = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description;
    if (input.source_type !== undefined) updateData.source_type = input.source_type;
    if (input.source_url !== undefined) updateData.source_url = input.source_url.trim();
    if (input.duration !== undefined) updateData.duration = input.duration;

    const { data, error } = await supabase
      .from("videos")
      .update(updateData as Database["public"]["Tables"]["videos"]["Update"])
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

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
export async function deleteVideo(videoId: string, workspaceId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", videoId)
      .eq("workspace_id", workspaceId);

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
): Promise<GeneratedWatchLink | null> {
  try {
    const supabase = createAdminClient();

    // Verify ownership first.
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

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
): Promise<boolean> {
  if (!linkId || !videoId || !workspaceId) return false;

  try {
    const supabase = createAdminClient();
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
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
  workspaceId: string
): Promise<VideoAnalytics | null> {
  try {
    const supabase = createAdminClient();

    const { data: video } = await supabase
      .from("videos")
      .select("id, title, duration, source_type")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!video) return null;

    const { data: rawSessions, error: sessionsError } = await supabase
      .from("watch_sessions")
      .select(`
        id,
        watch_link_id,
        viewer_identifier,
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
    const sessionIds = sessions.map((session) => session.id);
    let events: AnalyticsEventRow[] = [];
    if (sessionIds.length > 0) {
      const { data: rawEvents, error: eventsError } = await supabase
        .from("watch_events")
        .select("id, session_id, event_type, position, duration, from_position, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (eventsError) return null;
      events = (rawEvents ?? []) as unknown as AnalyticsEventRow[];
    }

    const totalViews = sessions.length;
    const uniqueViewers = new Set(sessions.map((session) => session.viewer_identifier ?? session.id)).size;
    const playbackMetricsScope = video.source_type === "direct_url"
      ? "direct_url_native_html5" as const
      : video.source_type === "youtube"
        ? "youtube_iframe_api" as const
        : "session_only" as const;
    const measurableSessionIds = new Set(events.filter(isValidTelemetryEvent).map((event) => event.session_id));
    const measuredSessions = supportsPlaybackMetrics(video.source_type)
      ? sessions.filter((session) => measurableSessionIds.has(session.id))
      : [];
    const measuredCount = measuredSessions.length;
    const videoInfo: AnalyticsVideoInfo = {
      id: video.id,
      title: video.title,
      source_type: video.source_type as Video["source_type"],
    };
    const viewerSessions = buildViewerSessionAnalytics(
      sessions,
      events,
      new Map(sessions.map((session) => [session.id, videoInfo])),
    );

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
      watch_time_seconds: supportsPlaybackMetrics(video.source_type) && measurableSessionIds.has(session.id) ? session.watch_time_seconds ?? 0 : null,
      completion_percentage: supportsPlaybackMetrics(video.source_type) && measurableSessionIds.has(session.id) ? Number(session.completion_percentage ?? 0) : null,
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
  clickupTaskName?: string
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
export async function getWorkspaceAnalytics(workspaceId: string): Promise<WorkspaceAnalytics> {
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

    const { count: videoCount, error: videoCountError } = await supabase
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (videoCountError) return empty;

    const { data: rawSessions, error: sessionsError } = await supabase
      .from("watch_sessions")
      .select(`
        id,
        watch_link_id,
        viewer_identifier,
        started_at,
        last_seen_at,
        ended_at,
        watch_time_seconds,
        completion_percentage,
        watch_links!inner(
          video_id,
          videos!inner(id, title, workspace_id, source_type)
        )
      `)
      .eq("watch_links.videos.workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(2000);
    if (sessionsError) return empty;

    const workspaceSessions: AnalyticsSessionRow[] = [];
    const sessionVideos = new Map<string, { id: string; title: string; source_type: Video["source_type"] }>();
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
      workspaceSessions.push(row);
      sessionVideos.set(row.id, {
        id: relatedVideo.id,
        title: relatedVideo.title,
        source_type: relatedVideo.source_type,
      });
    }

    const sessionIds = workspaceSessions.map((session) => session.id);
    let events: AnalyticsEventRow[] = [];
    if (sessionIds.length > 0) {
      const { data: rawEvents, error: eventsError } = await supabase
        .from("watch_events")
        .select("id, session_id, event_type, position, duration, from_position, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true })
        .limit(10000);
      if (eventsError) return empty;
      events = (rawEvents ?? []) as unknown as AnalyticsEventRow[];
    }

    const viewerSessions = buildViewerSessionAnalytics(workspaceSessions, events, sessionVideos);
    const totalViews = workspaceSessions.length;
    const uniqueViewers = new Set(workspaceSessions.map((session) => session.viewer_identifier ?? session.id)).size;
    const measurableSessionIds = new Set(events.filter(isValidTelemetryEvent).map((event) => event.session_id));
    const measuredSessions = workspaceSessions.filter((session) => {
      const sourceType = sessionVideos.get(session.id)?.source_type;
      return sourceType === "direct_url" || sourceType === "youtube"
        ? measurableSessionIds.has(session.id)
        : false;
    });
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
        title: video.title,
        source_type: video.source_type,
        total_views: 0,
        measurable_watch_time_seconds: null,
      };
      summary.total_views += 1;
      if ((video.source_type === "direct_url" || video.source_type === "youtube") && measurableSessionIds.has(session.id)) {
        summary.measurable_watch_time_seconds = (summary.measurable_watch_time_seconds ?? 0) + (session.watch_time_seconds ?? 0);
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
    };
  } catch {
    return empty;
  }
}
