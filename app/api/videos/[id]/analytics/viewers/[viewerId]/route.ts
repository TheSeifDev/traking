import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { resolveSpaceAdminForUser } from "@/src/lib/spaces/access";
import { spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getVideoViewerAnalytics } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ id: string; viewerId: string }> };

export const GET = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { id, viewerId } = await (context as RouteContext).params;
  if (!id || !viewerId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    const access = await resolveSpaceAdminForUser(request, user);
    const scope = spaceDataScope(access.space);
    if (!scope) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const analytics = await getVideoViewerAnalytics(id, scope, decodeURIComponent(viewerId));
    if (!analytics) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ analytics, space: { id: access.space.id, name: access.space.name } });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});
