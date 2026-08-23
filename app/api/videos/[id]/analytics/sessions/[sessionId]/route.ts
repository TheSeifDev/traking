import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getVideoSessionAnalytics } from "@/src/lib/videos/service";
import { PERMISSIONS } from "@/src/types/permissions";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

export const GET = withPermission(
  PERMISSIONS.ANALYTICS_READ,
  async (_request: NextRequest, user, context) => {
    const { id, sessionId } = await (context as RouteContext).params;
    if (!id || !sessionId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });
    const analytics = await getVideoSessionAnalytics(id, workspaceId, sessionId);
    if (!analytics) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ analytics });
  },
);
