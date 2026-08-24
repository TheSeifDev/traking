import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { USER_ROLES } from "@/src/types/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { getClickUpSpacesForSync, getClickUpTeamForSync } from "@/src/lib/clickup/client";
import { syncClickUpAuthorizedTeams } from "@/src/lib/clickup/sync";

type SyncBody = { organization_id?: unknown; mode?: unknown };

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export const POST = withRole(USER_ROLES.OWNER, async (request: NextRequest, user) => {
  let body: SyncBody;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    body = parsed as SyncBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const organizationId = typeof body.organization_id === "string" ? body.organization_id.trim() : "";
  const mode = body.mode === "preview" ? "preview" : body.mode === "apply" ? "apply" : "";
  if (!isUuid(organizationId) || !mode) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: organization, error: organizationError } = await supabase.from("organizations").select("id, name, clickup_workspace_id").eq("id", organizationId).maybeSingle();
  if (organizationError) return NextResponse.json({ error: "database_error" }, { status: 500 });
  if (!organization) return NextResponse.json({ error: "organization_not_found" }, { status: 404 });
  if (!organization.clickup_workspace_id) return NextResponse.json({ error: "organization_not_connected" }, { status: 422 });

  const { data: workspace, error: workspaceError } = await supabase.from("workspaces").select("id, clickup_team_id, name").eq("id", organization.clickup_workspace_id).maybeSingle();
  if (workspaceError) return NextResponse.json({ error: "database_error" }, { status: 500 });
  if (!workspace) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });

  const team = await getClickUpTeamForSync(user.id, workspace.id, workspace.clickup_team_id);
  if (!team) return NextResponse.json({ error: "clickup_sync_unavailable" }, { status: 502 });
  const spaces = await getClickUpSpacesForSync(user.id, workspace.id, workspace.clickup_team_id);
  if (!spaces) return NextResponse.json({ error: "clickup_spaces_unavailable" }, { status: 502 });

  if (mode === "preview") {
    const ids = spaces.map((space) => space.id);
    const { data: existing } = ids.length > 0 ? await supabase.from("spaces").select("id, name, clickup_space_id").eq("organization_id", organization.id).in("clickup_space_id", ids).limit(500) : { data: [] };
    const existingByClickUpId = new Map((existing ?? []).map((space) => [space.clickup_space_id, space]));
    return NextResponse.json({
      mode,
      organization: { id: organization.id, name: organization.name },
      workspace: { id: workspace.id, team_id: workspace.clickup_team_id, name: workspace.name },
      spaces: spaces.map((space) => ({ id: space.id, name: space.name, private: space.private, member_evidence: space.private === true && Array.isArray(space.members) ? "available" : "unavailable_for_public_or_missing_response", existing_trackup_space_id: existingByClickUpId.get(space.id)?.id ?? null, action: existingByClickUpId.has(space.id) ? "update" : "create" })),
      note: "Preview performs read-only provider/database queries. Apply creates or updates only explicit ClickUp Space mappings and does not delete or suspend absent members.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const summary = await syncClickUpAuthorizedTeams(user.id, user.role, [team]);
  return NextResponse.json({ mode, synced: summary.failed_teams === 0, summary }, { headers: { "Cache-Control": "no-store" } });
});
