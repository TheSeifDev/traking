/**
 * /api/clickup/tasks/[taskId]
 * POST { video_id, task_name? } - Associate a ClickUp task with a video
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { associateClickUpTask } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ taskId: string }> };

export const POST = withPermission(
  PERMISSIONS.VIDEOS_UPDATE,
  async (request: NextRequest, user, context) => {
    const { taskId } = await (context as RouteContext).params;
    if (!taskId) return NextResponse.json({ error: "missing_task_id" }, { status: 400 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

    const b = body as Record<string, unknown>;
    const videoId = typeof b.video_id === "string" ? b.video_id.trim() : "";
    const taskName = typeof b.task_name === "string" ? b.task_name.trim() : undefined;

    if (!videoId) return NextResponse.json({ error: "missing_video_id" }, { status: 400 });

    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });

    const ok = await associateClickUpTask(videoId, workspaceId, taskId, taskName);
    if (!ok) return NextResponse.json({ error: "association_failed" }, { status: 500 });

    return NextResponse.json({ associated: true });
  }
);