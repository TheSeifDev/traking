/**
 * ClickUp Connection & Workspace Persistence
 *
 * After successful OAuth, we:
 * 1. Upsert the ClickUp team into `workspaces`.
 * 2. Upsert the access_token into `clickup_connections`.
 *
 * The access_token NEVER leaves server-side code.
 */
import { createAdminClient } from "@/utils/supabase/admin";

export interface ClickUpTeam {
  id: string;
  name: string;
}

/**
 * Persists the ClickUp workspace + access token for a profile.
 * Idempotent: safe to call on every login.
 */
export async function upsertClickUpConnection(
  profileId: string,
  team: ClickUpTeam,
  accessToken: string
): Promise<{ workspaceId: string } | null> {
  try {
    const supabase = createAdminClient();

    // 1. Upsert workspace
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .upsert(
        { clickup_team_id: team.id, name: team.name },
        { onConflict: "clickup_team_id", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (wsError || !workspace) {
      console.error("Failed to upsert workspace", wsError);
      return null;
    }

    // 2. Upsert clickup_connection (store token server-side)
    const { error: connError } = await supabase
      .from("clickup_connections")
      .upsert(
        {
          profile_id: profileId,
          workspace_id: workspace.id,
          access_token: accessToken,
        },
        { onConflict: "profile_id,workspace_id" }
      );

    if (connError) {
      console.error("Failed to upsert clickup_connection", connError);
      return null;
    }

    return { workspaceId: workspace.id };
  } catch {
    console.error("Unexpected error in upsertClickUpConnection");
    return null;
  }
}

/**
 * Returns the first workspace ID for a profile (for MVP single-workspace flow).
 */
export async function getPrimaryWorkspaceId(profileId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clickup_connections")
      .select("workspace_id")
      .eq("profile_id", profileId)
      .limit(1)
      .maybeSingle();

    return data?.workspace_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns basic workspace info for a profile.
 */
export async function getPrimaryWorkspace(profileId: string): Promise<{
  id: string;
  name: string;
  clickup_team_id: string;
} | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clickup_connections")
      .select("workspace_id, workspaces(id, name, clickup_team_id)")
      .eq("profile_id", profileId)
      .limit(1)
      .maybeSingle();

    if (!data?.workspaces) return null;
    const ws = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;
    if (!ws) return null;
    return { id: ws.id, name: ws.name, clickup_team_id: ws.clickup_team_id };
  } catch {
    return null;
  }
}
