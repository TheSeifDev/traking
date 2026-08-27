/**
 * /api/videos
 *
 * GET  – List videos for the selected accessible Space.
 * POST – Create a video for the selected Space admin/owner.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { resolveMutationScopeForUser, resolveSpaceForUser } from "@/src/lib/spaces/access";
import { authorizeAllSpacesForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getWorkspaceAnalytics, listVideos, createVideo } from "@/src/lib/videos/service";
import { isValidSourceType, type Video, type WorkspaceAnalytics } from "@/src/types/video";
import { isValidSourceUrl } from "@/src/lib/playback/providers";

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

const emptySummary = { total_videos: 0, active_links: 0, total_sessions: 0, total_viewers: 0 };

export const GET = withDashboardAuth(async (request: NextRequest, user) => {
  try {
    const organizationId = request.nextUrl.searchParams.get("organization_id")?.trim() || null;
    if (organizationId) {
      const organization = await authorizeAllSpacesForUser(organizationId, user);
      const scope = organizationDataScope(organization);
      if (!scope) return NextResponse.json({ videos: [], summary: emptySummary, organization: { id: organization.id, name: organization.name }, active_space_scope: "all", space_connected: false });
      const [rawVideos, analytics] = await Promise.all([
        listVideos(scope),
        getWorkspaceAnalytics(scope, undefined, undefined, false),
      ]);
      const videos = addLibraryAnalytics(rawVideos, analytics.viewer_sessions, analytics.total_videos === rawVideos.length);
      const now = Date.now();
      const activeLinks = videos.reduce((total, video) => total + (video.watch_links?.some((link) => !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now)) ? 1 : 0), 0);
      return NextResponse.json({
        videos,
        organization: { id: organization.id, name: organization.name },
        active_space_scope: "all",
        space_connected: true,
        summary: { total_videos: videos.length, active_links: activeLinks, total_sessions: analytics.total_sessions, total_viewers: analytics.unique_viewers },
      });
    }
    const access = await resolveSpaceForUser(request, user);
    const scope = spaceDataScope(access.space);
    if (!scope) {
      return NextResponse.json({ videos: [], summary: emptySummary, space_connected: false });
    }
    const [rawVideos, analytics] = await Promise.all([
      listVideos(scope),
      getWorkspaceAnalytics(scope),
    ]);
    const videos = addLibraryAnalytics(rawVideos, analytics.viewer_sessions, analytics.total_videos === rawVideos.length);
    const now = Date.now();
    const activeLinks = videos.reduce((total, video) => total + (video.watch_links?.some((link) => !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now)) ? 1 : 0), 0);
    return NextResponse.json({
      videos,
      space: { id: access.space.id, name: access.space.name },
      space_connected: true,
      summary: {
        total_videos: videos.length,
        active_links: activeLinks,
        total_sessions: analytics.total_sessions,
        total_viewers: analytics.unique_viewers,
      },
    });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});

export const POST = withDashboardAuth(async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const source_type = input.source_type;
  const source_url = typeof input.source_url === "string" ? input.source_url.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : null;
  const duration = typeof input.duration === "number" ? input.duration : null;
  if (!title || title.length > 255) return NextResponse.json({ error: "invalid_title" }, { status: 400 });
  if (!isValidSourceType(source_type)) return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
  if (!source_url || !isValidSourceUrl(source_type, source_url)) return NextResponse.json({ error: "invalid_source_url" }, { status: 400 });

  try {
    const scope = await resolveMutationScopeForUser(request, user);
    const video = await createVideo(scope.workspaceId, user.id, {
      title,
      description,
      source_type,
      source_url,
      duration,
    }, scope.spaceId ?? undefined);
    if (!video) return NextResponse.json({ error: "create_failed" }, { status: 500 });
    return NextResponse.json({
      video,
      scope: {
        organization_id: scope.organizationId,
        space_id: scope.spaceId,
        is_all_spaces: scope.spaceId === null,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Space not connected to ClickUp" || message === "Organization not connected to ClickUp") {
      return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    }
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});
