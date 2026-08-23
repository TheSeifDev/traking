import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { authorizeSpaceAdmin } from "@/src/lib/spaces/access";
import { getClickUpTeamForSync } from "@/src/lib/clickup/client";
import { syncClickUpAuthorizedTeams } from "@/src/lib/clickup/sync";
import { createAdminClient } from "@/utils/supabase/admin";

type RouteContext = { params: Promise<{ spaceId: string }> };

export const POST = withAuth(async (request: NextRequest, user, context) => {
  const { spaceId } = await (context as RouteContext).params;
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  try {
    const access = await authorizeSpaceAdmin(spaceId, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const supabase = createAdminClient();
    const { data: workspace, error: workspaceError } = await supabase.from("workspaces").select("clickup_team_id").eq("id", access.space.clickup_workspace_id).maybeSingle();
    if (workspaceError || !workspace) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
    const team = await getClickUpTeamForSync(user.id, access.space.clickup_workspace_id, workspace.clickup_team_id);
    if (!team) return NextResponse.json({ error: "clickup_sync_unavailable" }, { status: 502 });
    const summary = await syncClickUpAuthorizedTeams(user.id, user.role, [team]);
    return NextResponse.json({ synced: summary.failed_teams === 0, summary });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});
