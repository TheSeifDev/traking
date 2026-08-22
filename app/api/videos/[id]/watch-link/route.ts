/**
 * /api/videos/[id]/watch-link
 * POST - Generate a watch link for a video
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { generateWatchLink } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission(
  PERMISSIONS.VIDEOS_UPDATE,
  async (_request: NextRequest, user, context) => {
    const { id } = await (context as RouteContext).params;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });

    const link = await generateWatchLink(id, workspaceId, user.id);
    if (!link) return NextResponse.json({ error: "generation_failed" }, { status: 500 });

    return NextResponse.json({ watch_link: link }, { status: 201 });
  }
);