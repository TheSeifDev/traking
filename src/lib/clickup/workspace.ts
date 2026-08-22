import { createAdminClient } from "@/utils/supabase/admin";

export type ClickUpWorkspaceIdentity = {
  id: string;
  name: string;
};

/**
 * Persists the ClickUp workspace selected during OAuth and stores the access
 * token server-side. The token must never be returned to client code or stored
 * in a browser-readable cookie.
 */
export async function upsertClickUpConnection(
  profileId: string,
  workspace: ClickUpWorkspaceIdentity,
  accessToken: string
): Promise<boolean> {
  if (!profileId || !workspace.id || !workspace.name || !accessToken) {
    return false;
  }

  try {
    const supabase = createAdminClient();

    const { data: workspaceRow, error: workspaceError } = await supabase
      .from("workspaces")
      .upsert(
        {
          clickup_team_id: workspace.id,
          name: workspace.name,
        },
        { onConflict: "clickup_team_id" }
      )
      .select("id")
      .single();

    if (workspaceError || !workspaceRow) {
      console.error("Failed to upsert ClickUp workspace", {
        hasWorkspaceId: Boolean(workspace.id),
        hasWorkspaceName: Boolean(workspace.name),
      });
      return false;
    }

    const { error: connectionError } = await supabase
      .from("clickup_connections")
      .upsert(
        {
          profile_id: profileId,
          workspace_id: workspaceRow.id,
          access_token: accessToken,
        },
        { onConflict: "profile_id,workspace_id" }
      );

    if (connectionError) {
      console.error("Failed to upsert ClickUp connection", {
        profileId,
        workspaceId: workspaceRow.id,
      });
      return false;
    }

    return true;
  } catch {
    console.error("Unexpected error while upserting ClickUp connection");
    return false;
  }
}
