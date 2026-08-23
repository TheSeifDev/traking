import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { resolveSpaceAdminForUser } from "@/src/lib/spaces/access";
import { getVideoSessionAnalytics } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

export const GET = withAuth(async (request: NextRequest, user, context) => {
  const { id, sessionId } = await (context as RouteContext).params;
  if (!id || !sessionId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const analytics = await getVideoSessionAnalytics(id, access.space.clickup_workspace_id, sessionId, access.space.id);
    if (!analytics) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ analytics, space: { id: access.space.id, name: access.space.name } });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});
