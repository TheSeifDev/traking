/**
 * /api/videos/[id]/analytics
 * GET - Fetch aggregated analytics for a video
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { resolveSpaceAdminForUser } from "@/src/lib/spaces/access";
import { getVideoAnalytics } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const analytics = await getVideoAnalytics(id, access.space.clickup_workspace_id, access.space.id);
    if (!analytics) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ analytics, space: { id: access.space.id, name: access.space.name } });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});