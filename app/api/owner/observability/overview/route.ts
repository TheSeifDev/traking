import { type NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { getAccessibleOrganizations } from "@/src/lib/spaces/access";
import { getOwnerWorkspaceAnalytics } from "@/src/lib/observability/service";
import { USER_ROLES } from "@/src/types/auth";

export const GET = withRole(USER_ROLES.OWNER, async (request: NextRequest, user) => {
  const organizationId = request.nextUrl.searchParams.get("organization_id")
    || (await getAccessibleOrganizations(user))[0]?.id;
  if (!organizationId) return NextResponse.json({ error: "no_organization" }, { status: 404 });

  try {
    const analytics = await getOwnerWorkspaceAnalytics(organizationId);
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
