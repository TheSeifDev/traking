/**
 * /api/videos/[id]/analytics
 * GET - Fetch aggregated analytics for a video
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getVideoAnalytics } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission(
  PERMISSIONS.ANALYTICS_READ,
  async (_request: NextRequest, user, context) => {
    const { id } = await (context as RouteContext).params;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });

    const analytics = await getVideoAnalytics(id, workspaceId);
    if (!analytics) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json({ analytics });
  }
);