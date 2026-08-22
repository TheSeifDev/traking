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
/**
 * Returns the first workspace ID for a profile (for MVP single-workspace flow).
 
 */
export async function getPrimaryWorkspaceId(profileId: string): Promise<string | null> {
  
  if (!profileId) return null;
  
  
  try {
    
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
    
      .from("clickup_connections")
    
      .select("workspace_id")
    
      .eq("profile_id", profileId)
    
      .limit(1)
    
      .maybeSingle();
    
    
    if (error) return null;
    
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
  
  if (!profileId) return null;
  
  
  try {
    
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
    
      .from("clickup_connections")
    
      .select("workspace_id, workspaces(id, name, clickup_team_id)")
    
      .eq("profile_id", profileId)
    
      .limit(1)
    
      .maybeSingle();
    
    
    if (error || !data?.workspaces) return null;
    
    const workspace = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;
    
    if (!workspace) return null;
    
    
    return {
      
      id: workspace.id,
      
      name: workspace.name,
      
      clickup_team_id: workspace.clickup_team_id,
      
    };
    
  } catch {
    
    return null;
    
  }
  
}
