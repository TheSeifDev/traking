/**
 * ClickUp API Client — Server-Side Only
 *
 * All calls to the ClickUp API must go through this module.
 * The access token is retrieved from the database (clickup_connections),
 * never from cookies or client-supplied values.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import { getClickUpTokenForWorkspace } from "@/src/lib/clickup/workspace";

/**
 * Fetches the stored ClickUp access token for a profile.
 * Returns null if no connection exists.
 */
export async function getClickUpToken(profileId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("clickup_connections")
      .select("access_token")
      .eq("profile_id", profileId)
      .limit(1)
      .maybeSingle();

    return data?.access_token ?? null;
  } catch {
    return null;
  }
}

export interface ClickUpTeamForSync {
  id: string;
  name: string;
  members?: unknown;
}

export async function getClickUpTeamForSync(profileId: string, workspaceId: string, clickupTeamId: string): Promise<ClickUpTeamForSync | null> {
  const token = await getClickUpTokenForWorkspace(profileId, workspaceId);
  if (!token) return null;
  try {
    const response = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const teams = (data as { teams?: unknown }).teams;
    if (!Array.isArray(teams)) return null;
    const match = teams.find((raw) => {
      if (!raw || typeof raw !== "object") return false;
      const id = (raw as Record<string, unknown>).id;
      return (typeof id === "string" || typeof id === "number") && String(id) === clickupTeamId;
    });
    if (!match || typeof match !== "object") return null;
    const team = match as Record<string, unknown>;
    const id = typeof team.id === "string" || typeof team.id === "number" ? String(team.id) : "";
    const name = typeof team.name === "string" ? team.name.trim() : "";
    if (!id || !name) return null;
    return { id, name, members: team.members };
  } catch {
    return null;
  }
}

export interface ClickUpTask {
  id: string;
  name: string;
  status?: { status: string } | null;
  url?: string;
}

/**
 * Searches for ClickUp tasks by query string within a team.
 * Server-side only — uses the stored access token.
 */
export async function searchClickUpTasks(
  profileId: string,
  teamId: string,
  query: string
): Promise<ClickUpTask[]> {
  const token = await getClickUpToken(profileId);
  if (!token) return [];

  try {
    const params = new URLSearchParams({ query, team_id: teamId });
    const response = await fetch(
      `https://api.clickup.com/api/v2/team/${encodeURIComponent(teamId)}/task?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 0 },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data.tasks)) return [];

    return (data.tasks as Record<string, unknown>[]).map((t) => ({
      id: String(t.id ?? ""),
      name: String(t.name ?? ""),
      status: t.status ? { status: String((t.status as Record<string, unknown>).status ?? "") } : null,
      url: t.url ? String(t.url) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Returns the ClickUp teams authorized for the given access token.
 * Used during OAuth callback to find the primary workspace.
 */
export async function getClickUpTeams(
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data.teams)) return [];
    return (data.teams as Record<string, unknown>[]).map((t) => ({
      id: String(t.id ?? ""),
      name: String(t.name ?? ""),
    }));
  } catch {
    return [];
  }
}
