import { NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getOwnerWorkspaceAnalytics } from "@/src/lib/observability/service";
import { USER_ROLES } from "@/src/types/auth";

export const GET = withRole(USER_ROLES.OWNER, async (_request, user) => {
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });

  try {
    const analytics = await getOwnerWorkspaceAnalytics(workspaceId);
    const recentActivity = analytics.recent_activity;
    return NextResponse.json({
      overview: {
        ...analytics,
        viewer_sessions: undefined,

        recent_activity: recentActivity.slice(0, 25).map((session) => ({
          session_id: session.session_id,
          viewer_profile_id: session.viewer_profile_id ?? null,
          viewer_name: session.viewer_name ?? null,
          viewer_email: session.viewer_email ?? null,
          video_id: session.video_id,
          video_title: session.video_title,
          source_type: session.source_type,
          started_at: session.started_at,
          first_play_at: session.first_play_at,
          last_activity_at: session.last_activity_at,
          ended_at: session.ended_at,
          watch_time_seconds: session.watch_time_seconds,
          completion_percentage: session.completion_percentage,
          telemetry_state: session.telemetry_state,
          telemetry_event_count: session.telemetry_event_count,
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "overview_unavailable" }, { status: 503 });
  }
});
