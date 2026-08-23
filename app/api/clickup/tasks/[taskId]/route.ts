/**
 * /api/clickup/tasks/[taskId]
 * POST { video_id, task_name? } - Associate a ClickUp task with a video
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { resolveSpaceAdminForUser } from "@/src/lib/spaces/access";
import { associateClickUpTask } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ taskId: string }> };

export const POST = withAuth(async (request: NextRequest, user, context) => {
  const { taskId } = await (context as RouteContext).params;
  if (!taskId) return NextResponse.json({ error: "missing_task_id" }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const b = body as Record<string, unknown>;
  const videoId = typeof b.video_id === "string" ? b.video_id.trim() : "";
  const taskName = typeof b.task_name === "string" ? b.task_name.trim() : undefined;
  if (!videoId) return NextResponse.json({ error: "missing_video_id" }, { status: 400 });

  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const ok = await associateClickUpTask(videoId, access.space.clickup_workspace_id, taskId, taskName, access.space.id);
    if (!ok) return NextResponse.json({ error: "association_failed" }, { status: 500 });
    return NextResponse.json({ associated: true, space: { id: access.space.id, name: access.space.name } });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});