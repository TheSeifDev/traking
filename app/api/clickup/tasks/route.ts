/**
 * /api/clickup/tasks
 * GET ?q=query&space_id=id - Search ClickUp tasks for the selected Space.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { resolveSpaceAdminForUser } from "@/src/lib/spaces/access";
import { createAdminClient } from "@/utils/supabase/admin";
import { searchClickUpTasks } from "@/src/lib/clickup/client";

export const GET = withDashboardAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.trim().length < 1) return NextResponse.json({ tasks: [] });

  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ tasks: [], error: "space_not_connected" }, { status: 422 });
    const supabase = createAdminClient();
    const { data: workspace, error } = await supabase.from("workspaces").select("clickup_team_id").eq("id", access.space.clickup_workspace_id).maybeSingle();
    if (error || !workspace) return NextResponse.json({ tasks: [], error: "workspace_not_found" }, { status: 404 });
    const tasks = await searchClickUpTasks(user.id, workspace.clickup_team_id, q);
    return NextResponse.json({ tasks, space: { id: access.space.id, name: access.space.name } });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});
