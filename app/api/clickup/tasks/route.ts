/**
 * /api/clickup/tasks
 * GET ?q=query - Search ClickUp tasks for the user's workspace (server-side only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import { searchClickUpTasks } from "@/src/lib/clickup/client";

export const GET = withPermission(
  PERMISSIONS.VIDEOS_UPDATE,
  async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.trim().length < 1) {
    return NextResponse.json({ tasks: [] });
  }

  const workspace = await getPrimaryWorkspace(user.id);
  if (!workspace) {
    return NextResponse.json({ tasks: [], error: "no_workspace" });
  }

  const tasks = await searchClickUpTasks(user.id, workspace.clickup_team_id, q);
    return NextResponse.json({ tasks });
  },
);