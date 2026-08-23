import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { authorizeSpaceAdmin } from "@/src/lib/spaces/access";
import { getWorkspaceAnalytics } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ spaceId: string }> };

export const GET = withAuth(async (_request: NextRequest, user, context) => {
  const { spaceId } = await (context as RouteContext).params;
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  try {
    const access = await authorizeSpaceAdmin(spaceId, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ analytics: null, space_connected: false });
    const analytics = await getWorkspaceAnalytics(access.space.clickup_workspace_id, access.space.id);
    return NextResponse.json({ analytics, space: { id: access.space.id, name: access.space.name }, space_connected: true });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});
