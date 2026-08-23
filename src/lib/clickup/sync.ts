import { createAdminClient } from "@/utils/supabase/admin";
import { writeOwnerLog } from "@/src/lib/observability/logger";
import { isOwner } from "@/src/lib/auth/rbac";
import type { UserRole } from "@/src/types/auth";

type ClickUpTeamInput = { id: string; name: string; members?: unknown };
type ClickUpMemberIdentity = { clickup_user_id: string; email: string | null; name: string | null };

type SyncSummary = {
  teams: number;
  spaces: number;
  memberships_added_or_updated: number;
  memberships_suspended: number;
  unmatched_clickup_members: number;
  incomplete_member_responses: number;
  failed_teams: number;
};

const MAX_MEMBERS_PER_TEAM = 500;
const MAX_TEAMS = 100;
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

function parseMembers(raw: unknown): { identities: ClickUpMemberIdentity[]; complete: boolean } {
  if (!Array.isArray(raw)) return { identities: [], complete: false };
  const seen = new Set<string>();
  const identities: ClickUpMemberIdentity[] = [];
  for (const item of raw.slice(0, MAX_MEMBERS_PER_TEAM)) {
    const member = parseMember(item);
    if (!member || seen.has(member.clickup_user_id)) continue;
    seen.add(member.clickup_user_id);
    identities.push(member);
  }
  // ClickUp's team response does not expose an authoritative roster-complete or pagination signal.
  // Treating this bounded array as complete would silently suspend valid TrackUp memberships.
  return { identities, complete: false };
}

function stableSlug(teamId: string): string {
  const normalized = teamId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 88);
  return `clickup-${normalized || "workspace"}`.slice(0, 96);
}

async function ensureSpaceForWorkspace(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  team: ClickUpTeamInput,
  profileId: string,
): Promise<{ id: string; created: boolean } | null> {
  const { data: existing, error: lookupError } = await supabase
    .from("spaces")
    .select("id")
    .eq("clickup_workspace_id", workspaceId)
    .maybeSingle();
  if (lookupError) return null;
  if (existing) return { id: existing.id, created: false };

  const { data: created, error: createError } = await supabase
    .from("spaces")
    .insert({ name: team.name, slug: stableSlug(team.id), clickup_workspace_id: workspaceId, created_by: profileId, settings: {} })
    .select("id")
    .single();
  if (!createError && created) return { id: created.id, created: true };

  // A concurrent OAuth callback may have won the unique workspace insert. Re-read it;
  // never retry an insert blindly and never overwrite the existing Space owner/settings.
  const { data: raced } = await supabase
    .from("spaces")
    .select("id")
    .eq("clickup_workspace_id", workspaceId)
    .maybeSingle();
  return raced ? { id: raced.id, created: false } : null;
}

async function findProfiles(supabase: ReturnType<typeof createAdminClient>, identities: ClickUpMemberIdentity[]) {
  const byClickUp = new Map<string, { id: string; email: string; role: UserRole; is_active: boolean }>();
  const byEmail = new Map<string, { id: string; email: string; role: UserRole; is_active: boolean }>();
  const clickupIds = identities.map((identity) => identity.clickup_user_id);
  const emails = identities.flatMap((identity) => identity.email ? [identity.email] : []);
  if (clickupIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, email, role, is_active, clickup_user_id").in("clickup_user_id", clickupIds).limit(MAX_MEMBERS_PER_TEAM);
    for (const profile of data ?? []) byClickUp.set(profile.clickup_user_id ?? "", profile);
  }
  if (emails.length > 0) {
    const { data } = await supabase.from("profiles").select("id, email, role, is_active, clickup_user_id").in("email", emails).limit(MAX_MEMBERS_PER_TEAM);
    for (const profile of data ?? []) byEmail.set(profile.email.toLowerCase(), profile);
  }
  return { byClickUp, byEmail };
}

export async function syncClickUpAuthorizedTeams(profileId: string, profileRole: UserRole, rawTeams: unknown): Promise<SyncSummary> {
  const summary: SyncSummary = { teams: 0, spaces: 0, memberships_added_or_updated: 0, memberships_suspended: 0, unmatched_clickup_members: 0, incomplete_member_responses: 0, failed_teams: 0 };
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

  for (const team of teams) {
    try {
      const { data: workspace, error: workspaceError } = await supabase.from("workspaces").upsert({ clickup_team_id: team.id, name: team.name }, { onConflict: "clickup_team_id" }).select("id").single();
      if (workspaceError || !workspace) {
        summary.failed_teams += 1;
        continue;
      }
      const ensuredSpace = await ensureSpaceForWorkspace(supabase, workspace.id, team, profileId);
      if (!ensuredSpace) {
        summary.failed_teams += 1;
        continue;
      }
      const spaceId = ensuredSpace.id;
      summary.teams += 1;
      summary.spaces += ensuredSpace.created ? 1 : 0;

      const parsed = parseMembers(team.members);
      if (!parsed.complete) summary.incomplete_member_responses += 1;
      const profiles = await findProfiles(supabase, parsed.identities);
      for (const identity of parsed.identities) {
        const profile = profiles.byClickUp.get(identity.clickup_user_id) ?? (identity.email ? profiles.byEmail.get(identity.email) : undefined);
        if (!profile || !profile.is_active) {
          summary.unmatched_clickup_members += 1;
          continue;
        }
        const { data: existingMembership } = await supabase.from("space_members").select("id, role, status, source, joined_at").eq("space_id", spaceId).eq("profile_id", profile.id).maybeSingle();
        const role = existingMembership?.role ?? (profile.id === profileId && (isOwner(profileRole) || profileRole === "admin") ? "admin" : "member");
        const source = existingMembership?.source ?? "clickup";
        const payload = { role, status: "active" as const, source, clickup_user_id: identity.clickup_user_id, last_synced_at: now, joined_at: existingMembership?.joined_at ?? now };
        const result = existingMembership
          ? await supabase.from("space_members").update(payload).eq("id", existingMembership.id)
          : await supabase.from("space_members").insert({ space_id: spaceId, profile_id: profile.id, ...payload });
        if (!result.error) summary.memberships_added_or_updated += 1;
      }

      // Deliberately do not suspend absent members. The ClickUp endpoint does not prove
      // that this bounded response is a complete, authoritative roster.

      const { data: actorMembership } = await supabase.from("space_members").select("id, role, status, source, joined_at").eq("space_id", spaceId).eq("profile_id", profileId).maybeSingle();
      if (!actorMembership) {
        await supabase.from("space_members").insert({ space_id: spaceId, profile_id: profileId, role: isOwner(profileRole) || profileRole === "admin" ? "admin" : "member", status: "active", source: "clickup", clickup_user_id: null, last_synced_at: now, joined_at: now });
      } else if (actorMembership.status !== "active") {
        await supabase.from("space_members").update({ status: "active", last_synced_at: now }).eq("id", actorMembership.id);
      }
    } catch {
      summary.failed_teams += 1;
    }
  }

  void writeOwnerLog({ level: summary.failed_teams > 0 ? "WARN" : "INFO", category: "AUTH", action: "clickup_members_synced", userId: profileId, metadata: summary });
  return summary;
}
