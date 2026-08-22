/**
 * Video Domain Service
 *
 * All video operations go through this module.
 * Authorization is enforced: all queries are scoped to the caller's workspace.
 * Uses the admin (service-role) client so RLS policies don't block service reads.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import type { Video, CreateVideoInput, UpdateVideoInput, VideoAnalytics, WorkspaceAnalytics, WatchSessionSummary } from "@/src/types/video";
import type { Database } from "@/src/types/database";
import { getAppUrl } from "@/src/lib/app-url";

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
          watch_sessions(id, completion_percentage)
        )
      `)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

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
  } catch {
    return [];
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
  createdBy: string
): Promise<{
  id: string;
  token: string;
  created_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  url: string;
} | null> {
  try {
    const supabase = createAdminClient();

    // Verify ownership first
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!video) return null;

    const { data, error } = await supabase
      .from("watch_links")
      .insert({ video_id: videoId, created_by: createdBy })
      .select("id, token, created_by, expires_at, revoked_at, created_at")
      .single();

    if (error || !data) {
      console.error("Failed to generate watch link", error);
      return null;
    }

    const appUrl = getAppUrl();
    return {
      id: data.id,
      token: data.token,
      created_by: data.created_by,
      expires_at: data.expires_at,
      revoked_at: data.revoked_at,
      created_at: data.created_at,
      url: `${appUrl}/watch/${data.token}`,
    };
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

    // Verify ownership
    const { data: video } = await supabase
      .from("videos")
      .select("id, duration, source_type")
      .eq("id", videoId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!video) return null;

    // Fetch all sessions for this video's watch links
    const { data: sessions } = await supabase
      .from("watch_sessions")
      .select(`
        id,
        viewer_identifier,
        started_at,
        ended_at,
        watch_time_seconds,
        completion_percentage,
        watch_links!inner(video_id)
      `)
      .eq("watch_links.video_id", videoId)
      .order("started_at", { ascending: false })
      .limit(500);

    const totalViews = sessions?.length ?? 0;
    const uniqueViewers = new Set((sessions ?? []).map((s) => s.viewer_identifier ?? s.id)).size;
    const playbackMetricsScope = video.source_type === "direct_url" ? "direct_url_native_html5" as const : "session_only" as const;
    const measuredSessions = video.source_type === "direct_url" ? (sessions ?? []) : [];
    const measuredCount = measuredSessions.length;

    if (totalViews === 0) {
      return {
        video_id: videoId,
        total_views: 0,
        unique_viewers: 0,
        playback_metrics_scope: playbackMetricsScope,
        avg_watch_time_seconds: null,
        avg_completion_percentage: null,
        completion_rate: null,
        drop_off_point: null,
        recent_sessions: [],
      };
    }

    const avgWatchTime = measuredCount > 0
      ? Math.round(
          measuredSessions.reduce((sum, s) => sum + (s.watch_time_seconds ?? 0), 0) / measuredCount
        )
      : null;
    const avgCompletion = measuredCount > 0
      ? Math.round(
          measuredSessions.reduce((sum, s) => sum + Number(s.completion_percentage ?? 0), 0) / measuredCount
        )
      : null;
    const completionRate = measuredCount > 0
      ? Math.round(
          (measuredSessions.filter((s) => Number(s.completion_percentage) >= 90).length / measuredCount) * 100
        )
      : null;

    // Drop-off: average final position for measured sessions that didn't complete
    const incompleteSessions = measuredSessions.filter((s) => Number(s.completion_percentage) < 90);
    let dropOffPoint: number | null = null;
    if (incompleteSessions.length > 0 && video.duration) {
      const avgDropPct =
        incompleteSessions.reduce((sum, s) => sum + Number(s.completion_percentage), 0) /
        incompleteSessions.length;
      dropOffPoint = Math.round((avgDropPct / 100) * (video.duration ?? 0));
    }

    const recentSessions: WatchSessionSummary[] = (sessions ?? []).slice(0, 10).map((s) => ({
      id: s.id,
      viewer_identifier: s.viewer_identifier,
      started_at: s.started_at,
      ended_at: s.ended_at,
      watch_time_seconds: video.source_type === "direct_url" ? s.watch_time_seconds ?? 0 : null,
      completion_percentage: video.source_type === "direct_url" ? Number(s.completion_percentage ?? 0) : null,
    }));

    return {
      video_id: videoId,
      total_views: totalViews,
      unique_viewers: uniqueViewers,
      playback_metrics_scope: playbackMetricsScope,
      avg_watch_time_seconds: avgWatchTime,
      avg_completion_percentage: avgCompletion,
      completion_rate: completionRate,
      drop_off_point: dropOffPoint,
      recent_sessions: recentSessions,
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
  try {
    const supabase = createAdminClient();

    const { count: videoCount } = await supabase
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    // Get all sessions for this workspace
    const { data: sessions } = await supabase
      .from("watch_sessions")
      .select(`
        id,
        viewer_identifier,
        completion_percentage,
        watch_links!inner(video_id, videos!inner(workspace_id, source_type))
      `)
      .eq("watch_links.videos.workspace_id", workspaceId)
      .limit(2000);

    const total_views = sessions?.length ?? 0;
    const unique_viewers = sessions
      ? new Set(sessions.map((s) => s.viewer_identifier ?? s.id)).size
      : 0;
    const measuredSessions = (sessions ?? []).filter((session) => {
      const rawLink = (session as { watch_links?: unknown }).watch_links;
      const link = Array.isArray(rawLink) ? rawLink[0] : rawLink;
      const rawVideo = link && typeof link === "object"
        ? (link as { videos?: unknown }).videos
        : null;
      const video = Array.isArray(rawVideo) ? rawVideo[0] : rawVideo;
      return video && typeof video === "object" &&
        (video as { source_type?: unknown }).source_type === "direct_url";
    });
    const measuredCount = measuredSessions.length;
    const avg_completion_percentage =
      measuredCount > 0
        ? Math.round(
            measuredSessions.reduce((sum, s) => sum + Number(s.completion_percentage ?? 0), 0) /
              measuredCount
          )
        : null;
    const completion_rate =
      measuredCount > 0
        ? Math.round(
            (measuredSessions.filter((s) => Number(s.completion_percentage) >= 90).length /
              measuredCount) *
              100
          )
        : null;

    return {
      total_videos: videoCount ?? 0,
      total_views,
      unique_viewers,
      avg_completion_percentage,
      completion_rate,
      playback_metrics_available: measuredCount > 0,
    };
  } catch {
    return {
      total_videos: 0,
      total_views: 0,
      unique_viewers: 0,
      avg_completion_percentage: null,
      completion_rate: null,
      playback_metrics_available: false,
    };
  }
}
