import { createAdminClient } from "@/utils/supabase/admin";
import { getClickUpSpacesForSync } from "@/src/lib/clickup/client";
import { writeOwnerLog } from "@/src/lib/observability/logger";
import { isOwner } from "@/src/lib/auth/rbac";
import type { UserRole } from "@/src/types/auth";

type ClickUpTeamInput = { id: string; name: string; members?: unknown };
type ClickUpMemberIdentity = { clickup_user_id: string; email: string | null; name: string | null };
type ClickUpSpaceInput = { id: string; name: string; private: boolean | null; members?: unknown };

export type SyncSummary = {
  teams: number;
  organizations: number;
  spaces: number;
  spaces_created_or_updated: number;
  memberships_added_or_updated: number;
  memberships_suspended: number;
  unmatched_clickup_members: number;
  incomplete_member_responses: number;
  space_rosters_unavailable: number;
  failed_teams: number;
  teams_without_linked_space: number;
};

const MAX_MEMBERS_PER_TEAM = 500;
const MAX_TEAMS = 100;
const MAX_SPACES_PER_TEAM = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function parseMember(raw: unknown): ClickUpMemberIdentity | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const rawUser = entry.user && typeof entry.user === "object" ? entry.user as Record<string, unknown> : entry;
  const rawId = rawUser.id;
  if (typeof rawId !== "string" && typeof rawId !== "number") return null;
  const clickupUserId = String(rawId).trim();
  if (!clickupUserId) return null;
  const rawEmail = cleanText(rawUser.email, 320);
  const email = rawEmail && EMAIL_PATTERN.test(rawEmail) ? rawEmail.toLowerCase() : null;
  const name = cleanText(rawUser.username ?? rawUser.name, 160);
  return { clickup_user_id: clickupUserId, email, name };
}

function parseMembers(raw: unknown): { identities: ClickUpMemberIdentity[]; available: boolean } {
  if (!Array.isArray(raw)) return { identities: [], available: false };
  const seen = new Set<string>();
  const identities: ClickUpMemberIdentity[] = [];
  for (const item of raw.slice(0, MAX_MEMBERS_PER_TEAM)) {
    const member = parseMember(item);
    if (!member || seen.has(member.clickup_user_id)) continue;
    seen.add(member.clickup_user_id);
    identities.push(member);
  }
  return { identities, available: true };
}

function clickUpSpaceSlug(space: ClickUpSpaceInput): string {
  const readable = space.name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "space";
  const suffix = space.id.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-20) || "linked";
  return `clickup-${readable}-${suffix}`.slice(0, 96);
}

function parseSpaces(raw: unknown): ClickUpSpaceInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_SPACES_PER_TEAM).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const space = item as Record<string, unknown>;
    const id = cleanText(space.id, 120);
    const name = cleanText(space.name, 160);
    if (!id || !name) return [];
    return [{ id, name, private: typeof space.private === "boolean" ? space.private : null, members: space.members }];
  });
}

async function findProfiles(supabase: ReturnType<typeof createAdminClient>, identities: ClickUpMemberIdentity[]) {
  const byClickUp = new Map<string, { id: string; email: string; role: UserRole; is_active: boolean }>();
  const byEmail = new Map<string, { id: string; email: string; role: UserRole; is_active: boolean }>();
  const clickupIds = identities.map((identity) => identity.clickup_user_id);
  const emails = identities.flatMap((identity) => identity.email ? [identity.email] : []);
  if (clickupIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, email, role, is_active, clickup_user_id").in("clickup_user_id", clickupIds).limit(MAX_MEMBERS_PER_TEAM);
    for (const profile of data ?? []) if (profile.clickup_user_id) byClickUp.set(profile.clickup_user_id, profile);
  }
  if (emails.length > 0) {
    const { data } = await supabase.from("profiles").select("id, email, role, is_active, clickup_user_id").in("email", emails).limit(MAX_MEMBERS_PER_TEAM);
    for (const profile of data ?? []) byEmail.set(profile.email.toLowerCase(), profile);
  }
  return { byClickUp, byEmail };
}

async function syncOrganizationMembers(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  identities: ClickUpMemberIdentity[],
  actorId: string,
  actorRole: UserRole,
  now: string,
): Promise<{ added: number; unmatched: number }> {
  const profiles = await findProfiles(supabase, identities);
  let added = 0;
  let unmatched = 0;
  for (const identity of identities) {
    const profile = profiles.byClickUp.get(identity.clickup_user_id) ?? (identity.email ? profiles.byEmail.get(identity.email) : undefined);
    if (!profile || !profile.is_active) {
      unmatched += 1;
      continue;
    }
    const { data: existing } = await supabase.from("organization_members").select("id, role, status, joined_at").eq("organization_id", organizationId).eq("profile_id", profile.id).maybeSingle();
    const role: "admin" | "member" = existing?.role ?? (profile.id === actorId && isOwner(actorRole) ? "admin" : profile.role === "owner" || profile.role === "admin" ? "admin" : "member");
    const result = existing
      ? await supabase.from("organization_members").update({ role, status: "active", joined_at: existing.joined_at ?? now }).eq("id", existing.id)
      : await supabase.from("organization_members").insert({ organization_id: organizationId, profile_id: profile.id, role, status: "active", joined_at: now });
    if (!result.error) added += 1;
  }
  return { added, unmatched };
}

async function ensureSpaceMembership(
  supabase: ReturnType<typeof createAdminClient>,
  spaceId: string,
  profileId: string,
  profileRole: UserRole,
  clickupUserId: string | null,
  now: string,
): Promise<boolean> {
  const { data: existing } = await supabase.from("space_members").select("id, role, status, source, joined_at").eq("space_id", spaceId).eq("profile_id", profileId).maybeSingle();
  const role: "admin" | "member" = existing?.role ?? (isOwner(profileRole) || profileRole === "admin" ? "admin" : "member");
  const payload = { role, status: "active" as const, source: existing?.source ?? "clickup", clickup_user_id: clickupUserId, last_synced_at: now, joined_at: existing?.joined_at ?? now };
  const result = existing
    ? await supabase.from("space_members").update(payload).eq("id", existing.id)
    : await supabase.from("space_members").insert({ space_id: spaceId, profile_id: profileId, ...payload });
  return !result.error;
}

async function syncPrivateSpaceMembers(
  supabase: ReturnType<typeof createAdminClient>,
  spaceId: string,
  identities: ClickUpMemberIdentity[],
  actorId: string,
  actorRole: UserRole,
  now: string,
): Promise<{ added: number; unmatched: number }> {
  const profiles = await findProfiles(supabase, identities);
  let added = 0;
  let unmatched = 0;
  for (const identity of identities) {
    const profile = profiles.byClickUp.get(identity.clickup_user_id) ?? (identity.email ? profiles.byEmail.get(identity.email) : undefined);
    if (!profile || !profile.is_active) {
      unmatched += 1;
      continue;
    }
    if (await ensureSpaceMembership(supabase, spaceId, profile.id, profile.id === actorId ? actorRole : profile.role, identity.clickup_user_id, now)) added += 1;
  }
  return { added, unmatched };
}

export async function syncClickUpAuthorizedTeams(profileId: string, profileRole: UserRole, rawTeams: unknown): Promise<SyncSummary> {
  const summary: SyncSummary = { teams: 0, organizations: 0, spaces: 0, spaces_created_or_updated: 0, memberships_added_or_updated: 0, memberships_suspended: 0, unmatched_clickup_members: 0, incomplete_member_responses: 0, space_rosters_unavailable: 0, failed_teams: 0, teams_without_linked_space: 0 };
  if (!profileId || !Array.isArray(rawTeams)) return summary;
  const teams: ClickUpTeamInput[] = rawTeams.slice(0, MAX_TEAMS).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const team = raw as Record<string, unknown>;
    const id = cleanText(team.id, 120);
    const name = cleanText(team.name, 160);
    return id && name ? [{ id, name, members: team.members }] : [];
  });
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const canManageHierarchy = isOwner(profileRole) || profileRole === "admin";

  for (const team of teams) {
    let organizationId: string | null = null;
    try {
      const { data: workspace, error: workspaceError } = await supabase.from("workspaces").upsert({ clickup_team_id: team.id, name: team.name }, { onConflict: "clickup_team_id" }).select("id").single();
      if (workspaceError || !workspace) {
        summary.failed_teams += 1;
        continue;
      }
      const { data: organization, error: organizationError } = await supabase.from("organizations").select("id").eq("clickup_workspace_id", workspace.id).maybeSingle();
      if (organizationError || !organization) {
        summary.teams_without_linked_space += 1;
        continue;
      }
      organizationId = organization.id;
      summary.teams += 1;
      summary.organizations += 1;

      const spacesResponse = await getClickUpSpacesForSync(profileId, workspace.id, team.id);
      if (!spacesResponse) {
        summary.failed_teams += 1;
        if (canManageHierarchy) await supabase.from("organizations").update({ clickup_sync_status: "failed", clickup_last_synced_at: now, clickup_sync_error: "clickup_spaces_unavailable" }).eq("id", organizationId);
        continue;
      }
      const clickupSpaces = parseSpaces(spacesResponse);
      let teamPartial = false;
      for (const clickupSpace of clickupSpaces) {
        const { data: existingSpace, error: existingSpaceError } = await supabase.from("spaces").select("id, organization_id, name, slug, clickup_space_id, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, created_by").eq("clickup_space_id", clickupSpace.id).maybeSingle();
        if (existingSpaceError || (existingSpace && existingSpace.organization_id !== organizationId)) {
          teamPartial = true;
          continue;
        }
        let trackupSpaceId = existingSpace?.id ?? null;
        if (!trackupSpaceId && canManageHierarchy) {
          const { data: createdSpace, error: createError } = await supabase.from("spaces").insert({ organization_id: organizationId, name: clickupSpace.name, slug: clickUpSpaceSlug(clickupSpace), clickup_workspace_id: null, clickup_space_id: clickupSpace.id, clickup_sync_status: "running", clickup_last_synced_at: now, clickup_sync_error: null, created_by: profileId, settings: {} }).select("id").single();
          if (createError || !createdSpace) {
            teamPartial = true;
            continue;
          }
          trackupSpaceId = createdSpace.id;
          summary.spaces_created_or_updated += 1;
        } else if (trackupSpaceId && canManageHierarchy) {
          const { error: updateError } = await supabase.from("spaces").update({ name: clickupSpace.name, clickup_sync_status: "running", clickup_last_synced_at: now, clickup_sync_error: null }).eq("id", trackupSpaceId);
          if (updateError) teamPartial = true;
          else summary.spaces_created_or_updated += 1;
        }
        if (!trackupSpaceId) {
          summary.teams_without_linked_space += 1;
          continue;
        }
        summary.spaces += 1;
        if (clickupSpace.private !== true || !Array.isArray(clickupSpace.members)) {
          summary.space_rosters_unavailable += 1;
          summary.incomplete_member_responses += 1;
          teamPartial = true;
        } else {
          const parsedSpace = parseMembers(clickupSpace.members);
          const spaceResult = await syncPrivateSpaceMembers(supabase, trackupSpaceId, parsedSpace.identities, profileId, profileRole, now);
          summary.memberships_added_or_updated += spaceResult.added;
          summary.unmatched_clickup_members += spaceResult.unmatched;
          if (spaceResult.unmatched > 0) teamPartial = true;
        }
        if (await ensureSpaceMembership(supabase, trackupSpaceId, profileId, profileRole, null, now)) summary.memberships_added_or_updated += 1;
        if (canManageHierarchy) {
          await supabase.from("spaces").update({ clickup_sync_status: teamPartial ? "partial" : "success", clickup_last_synced_at: now, clickup_sync_error: teamPartial ? "member_roster_partial_or_unavailable" : null }).eq("id", trackupSpaceId);
        }
      }

      const teamMembers = parseMembers(team.members);
      if (!teamMembers.available) summary.incomplete_member_responses += 1;
      else {
        const orgResult = await syncOrganizationMembers(supabase, organizationId, teamMembers.identities, profileId, profileRole, now);
        summary.memberships_added_or_updated += orgResult.added;
        summary.unmatched_clickup_members += orgResult.unmatched;
        if (orgResult.unmatched > 0) teamPartial = true;
      }
      if (canManageHierarchy) await supabase.from("organizations").update({ clickup_sync_status: teamPartial || summary.space_rosters_unavailable > 0 ? "partial" : "success", clickup_last_synced_at: now, clickup_sync_error: teamPartial || summary.space_rosters_unavailable > 0 ? "member_roster_partial_or_unavailable" : null }).eq("id", organizationId);
    } catch {
      summary.failed_teams += 1;
      if (canManageHierarchy && organizationId) await supabase.from("organizations").update({ clickup_sync_status: "failed", clickup_last_synced_at: now, clickup_sync_error: "sync_failed" }).eq("id", organizationId);
    }
  }

  void writeOwnerLog({ level: summary.failed_teams > 0 ? "WARN" : "INFO", category: "AUTH", action: "clickup_members_synced", userId: profileId, metadata: summary });
  return summary;
}
