/**
 * /api/videos
 *
 * GET  – List videos for the authenticated user's workspace
 * POST – Create a new video (admin + owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getWorkspaceAnalytics, listVideos, createVideo } from "@/src/lib/videos/service";
import { isValidSourceType, type Video, type WorkspaceAnalytics } from "@/src/types/video";

function addLibraryAnalytics(videos: Video[], viewerSessions: WorkspaceAnalytics["viewer_sessions"], analyticsAvailable: boolean): Video[] {
  const byVideo = new Map<string, { viewers: Set<string>; measured: number; watchTime: number; completions: number[] }>();
  for (const session of viewerSessions) {
    const current = byVideo.get(session.video_id) ?? { viewers: new Set<string>(), measured: 0, watchTime: 0, completions: [] };
    current.viewers.add(session.viewer_identifier ?? session.session_id);
    if (session.has_playback_telemetry && session.watch_time_seconds !== null) {
      current.measured += 1;
      current.watchTime += session.watch_time_seconds;
      if (session.completion_percentage !== null) current.completions.push(session.completion_percentage);
    }
    byVideo.set(session.video_id, current);
  }

  return videos.map((video) => {
    const metrics = byVideo.get(video.id);
    if (!metrics) {
      return { ...video, unique_viewer_count: analyticsAvailable ? 0 : null, measurable_watch_time_seconds: null, avg_watch_time_seconds: null, playback_metrics_available: false };
    }
    return {
      ...video,
      unique_viewer_count: metrics.viewers.size,
      measurable_watch_time_seconds: metrics.measured > 0 ? Math.round(metrics.watchTime) : null,
      avg_watch_time_seconds: metrics.measured > 0 ? Math.round(metrics.watchTime / metrics.measured) : null,
      playback_metrics_available: metrics.measured > 0,
      avg_completion: metrics.completions.length > 0
        ? Math.round(metrics.completions.reduce((sum, value) => sum + value, 0) / metrics.completions.length)
        : null,
    };
  });
}

// GET /api/videos — requires videos.read
export const GET = withPermission(
  PERMISSIONS.VIDEOS_READ,
  async (_request: NextRequest, user) => {
    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ videos: [], summary: { total_videos: 0, active_links: 0, total_sessions: 0, total_viewers: 0 } });
    }

    const [rawVideos, analytics] = await Promise.all([
      listVideos(workspaceId),
      getWorkspaceAnalytics(workspaceId),
    ]);
    const analyticsAvailable = analytics.total_videos === rawVideos.length;
    const videos = addLibraryAnalytics(rawVideos, analytics.viewer_sessions, analyticsAvailable);
    const now = Date.now();
    const activeLinks = videos.reduce((total, video) => total + (video.watch_links?.filter((link) => !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now)).length ?? 0), 0);

    return NextResponse.json({
      videos,
      summary: {
        total_videos: videos.length,
        active_links: activeLinks,
        total_sessions: analyticsAvailable ? analytics.total_sessions : null,
        total_viewers: analyticsAvailable ? analytics.unique_viewers : null,
      },
    });
  },
);

// POST /api/videos — requires videos.create (admin + owner only)
export const POST = withPermission(
  PERMISSIONS.VIDEOS_CREATE,
  async (request: NextRequest, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const title = typeof b.title === "string" ? b.title.trim() : "";
    const source_type = b.source_type;
    const source_url = typeof b.source_url === "string" ? b.source_url.trim() : "";
    const description = typeof b.description === "string" ? b.description.trim() : null;
    const duration = typeof b.duration === "number" ? b.duration : null;

    if (!title || title.length > 255) {
      return NextResponse.json({ error: "invalid_title" }, { status: 400 });
    }
    if (!isValidSourceType(source_type)) {
      return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
    }
    if (!source_url) {
      return NextResponse.json({ error: "invalid_source_url" }, { status: 400 });
    }

    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "no_workspace" }, { status: 422 });
    }

    const video = await createVideo(workspaceId, user.id, {
      title,
      description,
      source_type,
      source_url,
      duration,
    });

    if (!video) {
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    return NextResponse.json({ video }, { status: 201 });
  },
);
