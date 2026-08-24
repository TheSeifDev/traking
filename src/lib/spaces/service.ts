import { createAdminClient } from "@/utils/supabase/admin";
import { isOwner } from "@/src/lib/auth/rbac";
import { authorizeOrganizationAdmin, authorizeSpaceAdmin, authorizeSpaceMember, getAccessibleSpaces } from "@/src/lib/spaces/access";
import type { AuthenticatedUser } from "@/src/types/auth";
import type { Database, SpaceMemberRole, SpaceMemberStatus } from "@/src/types/database";
import type { AccessibleSpace, Space, SpaceMember } from "@/src/types/space";

const MAX_SPACE_MEMBERS = 500;
const SPACE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,95}[a-z0-9]$/;

type OrganizationInsert = Database["public"]["Tables"]["organizations"]["Insert"];
type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type SpaceInsert = Database["public"]["Tables"]["spaces"]["Insert"];
type MembershipRow = Database["public"]["Tables"]["space_members"]["Row"];

const SPACE_FIELDS = "id, organization_id, name, slug, clickup_workspace_id, clickup_space_id, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, created_by, settings, archived_at, created_at, updated_at";

type ProfileSummary = {
  id: string;
  clickup_user_id: string | null;
  name: string | null;
  email: string;
  role: AuthenticatedUser["role"];
  is_active: boolean;
  last_seen_at: string | null;
};

export interface SpaceMemberView extends SpaceMember {
  profile: ProfileSummary;
}

export type SpaceMemberCandidate = Pick<ProfileSummary, "id" | "clickup_user_id" | "name" | "email" | "role">;

export type SpaceMutationError =
  | "forbidden"
  | "invalid_name"
  | "invalid_slug"
  | "slug_taken"
  | "clickup_workspace_not_found"
  | "database_error"
  | "member_not_found"
  | "membership_exists"
  | "invalid_role"
  | "cannot_modify_owner"
  | "cannot_modify_self"
  | "last_admin_required"
  | "organization_mismatch";

function toSpace(row: SpaceRow): Space {
  const settings = row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
    ? row.settings as Record<string, unknown>
    : {};
  return { ...row, settings };
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  const slug = normalized || "space";
  return slug.length >= 3 ? slug : `${slug}-space`;
}

export function normalizeSpaceSlug(value: string | null | undefined, fallbackName: string): string {
  return slugify(value?.trim() || fallbackName);
}

export async function listSpacesForUser(user: AuthenticatedUser): Promise<AccessibleSpace[]> {
  try {
    return await getAccessibleSpaces(user);
  } catch {
    return [];
  }
}

export async function getSpaceForUser(spaceId: string, user: AuthenticatedUser) {
  return authorizeSpaceMember(spaceId, user);
}

export async function createSpace(
  user: AuthenticatedUser,
  input: { name: string; slug?: string | null; organizationId?: string | null; clickupWorkspaceId?: string | null },
): Promise<{ success: true; space: Space; membership: SpaceMember } | { success: false; error: SpaceMutationError }> {
  const requestedOrganizationId = input.organizationId?.trim() || null;
  if (!isOwner(user.role) && !requestedOrganizationId) return { success: false, error: "forbidden" };
  if (requestedOrganizationId) {
    try {
      await authorizeOrganizationAdmin(requestedOrganizationId, user);
    } catch {
      return { success: false, error: "forbidden" };
    }
  }
  const name = input.name.trim();
  if (!name || name.length > 160) return { success: false, error: "invalid_name" };
  const slug = normalizeSpaceSlug(input.slug, name);
  if (!SPACE_SLUG_PATTERN.test(slug)) return { success: false, error: "invalid_slug" };
  const clickupWorkspaceId = input.clickupWorkspaceId?.trim() || null;

  try {
    const supabase = createAdminClient();
    let organizationId = requestedOrganizationId;
    let createdOrganizationId: string | null = null;
    if (clickupWorkspaceId) {
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", clickupWorkspaceId)
        .maybeSingle();
      if (workspaceError) return { success: false, error: "database_error" };
      if (!workspace) return { success: false, error: "clickup_workspace_not_found" };

      if (organizationId) {
        const { data: organization, error: organizationError } = await supabase
          .from("organizations")
          .select("id, clickup_workspace_id")
          .eq("id", organizationId)
          .maybeSingle();
        if (organizationError) return { success: false, error: "database_error" };
        if (!organization || (organization.clickup_workspace_id && organization.clickup_workspace_id !== clickupWorkspaceId)) {
          return { success: false, error: "organization_mismatch" };
        }
        if (!organization.clickup_workspace_id) {
          const { error: linkError } = await supabase.from("organizations").update({ clickup_workspace_id: clickupWorkspaceId }).eq("id", organizationId);
          if (linkError) return { success: false, error: linkError.code === "23505" ? "organization_mismatch" : "database_error" };
        }
      } else {
        const { data: linkedOrganization, error: linkedOrganizationError } = await supabase
          .from("organizations")
          .select("id")
          .eq("clickup_workspace_id", clickupWorkspaceId)
          .maybeSingle();
        if (linkedOrganizationError) return { success: false, error: "database_error" };
        organizationId = linkedOrganization?.id ?? null;
      }
    }

    if (!organizationId) {
      if (!isOwner(user.role)) return { success: false, error: "forbidden" };
      const organizationValues: OrganizationInsert = {
        name,
        slug: normalizeSpaceSlug(`${slug}-org`, `${name}-organization`),
        clickup_workspace_id: clickupWorkspaceId,
        created_by: user.id,
        settings: {},
      };
      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .insert(organizationValues)
        .select("id")
        .single();
      if (organizationError || !organization) return { success: false, error: organizationError?.code === "23505" ? "slug_taken" : "database_error" };
      organizationId = organization.id;
      createdOrganizationId = organization.id;
    }

    const values: SpaceInsert = {
      organization_id: organizationId,
      name,
      slug,
      clickup_workspace_id: clickupWorkspaceId,
      created_by: user.id,
      settings: {},
    };
    const { data: spaceRow, error: spaceError } = await supabase
      .from("spaces")
      .insert(values)
      .select(SPACE_FIELDS)
      .single();
    if (spaceError || !spaceRow) {
      if (createdOrganizationId) await supabase.from("organizations").delete().eq("id", createdOrganizationId);
      return { success: false, error: spaceError?.code === "23505" ? "slug_taken" : "database_error" };
    }

    const { data: membershipRow, error: membershipError } = await supabase
      .from("space_members")
      .insert({
        space_id: spaceRow.id,
        profile_id: user.id,
        role: "admin" as SpaceMemberRole,
        status: "active" as SpaceMemberStatus,
        source: "manual",
        clickup_user_id: null,
        last_synced_at: null,
        joined_at: new Date().toISOString(),
      })
      .select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at")
      .single();
    if (membershipError || !membershipRow) {
      await supabase.from("spaces").delete().eq("id", spaceRow.id);
      if (createdOrganizationId) await supabase.from("organizations").delete().eq("id", createdOrganizationId);
      return { success: false, error: "database_error" };
    }
    return { success: true, space: toSpace(spaceRow), membership: membershipRow };
  } catch {
    return { success: false, error: "database_error" };
  }
}

export async function searchSpaceMemberCandidates(spaceId: string, user: AuthenticatedUser, query: string): Promise<SpaceMemberCandidate[] | null> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 100) return [];
  try {
    await authorizeSpaceAdmin(spaceId, user);
    const supabase = createAdminClient();
    const [{ data: byEmail, error: emailError }, { data: byName, error: nameError }, { data: activeMemberships, error: membershipError }] = await Promise.all([
      supabase.from("profiles").select("id, clickup_user_id, name, email, role").eq("is_active", true).neq("role", "owner").ilike("email", `%${normalizedQuery}%`).limit(25),
      supabase.from("profiles").select("id, clickup_user_id, name, email, role").eq("is_active", true).neq("role", "owner").ilike("name", `%${normalizedQuery}%`).limit(25),
      supabase.from("space_members").select("profile_id").eq("space_id", spaceId).eq("status", "active").limit(MAX_SPACE_MEMBERS),
    ]);
    if (emailError || nameError || membershipError) return null;
    const activeIds = new Set((activeMemberships ?? []).map((membership) => membership.profile_id));
    const merged = [...(byEmail ?? []), ...(byName ?? [])];
    const seen = new Set<string>();
    return merged.filter((profile) => {
      if (activeIds.has(profile.id) || seen.has(profile.id)) return false;
      seen.add(profile.id);
      return true;
    }).slice(0, 25);
  } catch {
    return null;
  }
}

export async function listSpaceMembers(spaceId: string, user: AuthenticatedUser): Promise<SpaceMemberView[] | null> {
  try {
    await authorizeSpaceAdmin(spaceId, user);
    const supabase = createAdminClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("space_members")
      .select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at")
      .eq("space_id", spaceId)
      .neq("status", "removed")
      .order("created_at", { ascending: true })
      .limit(MAX_SPACE_MEMBERS);
    if (membershipError || !memberships) return null;
    if (memberships.length === 0) return [];

    const profileIds = memberships.map((membership) => membership.profile_id);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, clickup_user_id, name, email, role, is_active, last_seen_at")
      .in("id", profileIds)
      .limit(MAX_SPACE_MEMBERS);
    if (profileError || !profiles) return null;
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    return memberships.flatMap((membership) => {
      const profile = profilesById.get(membership.profile_id);
      return profile ? [{ ...membership, profile }] : [];
    });
  } catch {
    return null;
  }
}

async function loadMembership(spaceId: string, profileId: string): Promise<MembershipRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("space_members")
    .select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at")
    .eq("space_id", spaceId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function hasAnotherActiveAdmin(spaceId: string, excludedProfileId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("space_members")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId)
    .eq("role", "admin")
    .eq("status", "active")
    .neq("profile_id", excludedProfileId);
  return !error && (count ?? 0) > 0;
}

export async function addSpaceMember(
  spaceId: string,
  user: AuthenticatedUser,
  profileId: string,
  role: unknown,
): Promise<{ success: true; member: SpaceMemberView } | { success: false; error: SpaceMutationError }> {
  if (role !== "admin" && role !== "member") return { success: false, error: "invalid_role" };
  try {
    await authorizeSpaceAdmin(spaceId, user);
    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, clickup_user_id, name, email, role, is_active, last_seen_at")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError) return { success: false, error: "database_error" };
    if (!profile || !profile.is_active) return { success: false, error: "member_not_found" };
    if (profile.role === "owner") return { success: false, error: "cannot_modify_owner" };

    const existing = await loadMembership(spaceId, profileId);
    if (existing?.status === "active") return { success: false, error: "membership_exists" };
    const { data: member, error: memberError } = existing
      ? await supabase.from("space_members").update({ role, status: "active", joined_at: new Date().toISOString() }).eq("id", existing.id).select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at").single()
      : await supabase.from("space_members").insert({ space_id: spaceId, profile_id: profileId, role, status: "active", source: "manual", clickup_user_id: null, last_synced_at: null, joined_at: new Date().toISOString() }).select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at").single();
    if (memberError || !member) return { success: false, error: "database_error" };
    return { success: true, member: { ...member, profile } };
  } catch {
    return { success: false, error: "forbidden" };
  }
}

export async function updateSpaceMemberRole(
  spaceId: string,
  user: AuthenticatedUser,
  profileId: string,
  role: unknown,
): Promise<{ success: true; member: SpaceMemberView } | { success: false; error: SpaceMutationError }> {
  if (role !== "admin" && role !== "member") return { success: false, error: "invalid_role" };
  if (profileId === user.id) return { success: false, error: "cannot_modify_self" };
  try {
    await authorizeSpaceAdmin(spaceId, user);
    const existing = await loadMembership(spaceId, profileId);
    if (!existing || existing.status === "removed") return { success: false, error: "member_not_found" };
    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, clickup_user_id, name, email, role, is_active, last_seen_at")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError) return { success: false, error: "database_error" };
    if (!profile) return { success: false, error: "member_not_found" };
    if (profile.role === "owner") return { success: false, error: "cannot_modify_owner" };
    if (existing.role === "admin" && role === "member" && !(await hasAnotherActiveAdmin(spaceId, profileId))) {
      return { success: false, error: "last_admin_required" };
    }
    const { data: member, error: updateError } = await supabase
      .from("space_members")
      .update({ role })
      .eq("id", existing.id)
      .select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at")
      .single();
    if (updateError || !member) return { success: false, error: "database_error" };
    return { success: true, member: { ...member, profile } };
  } catch {
    return { success: false, error: "forbidden" };
  }
}

export async function removeSpaceMember(
  spaceId: string,
  user: AuthenticatedUser,
  profileId: string,
): Promise<{ success: true } | { success: false; error: SpaceMutationError }> {
  if (profileId === user.id) return { success: false, error: "cannot_modify_self" };
  try {
    await authorizeSpaceAdmin(spaceId, user);
    const existing = await loadMembership(spaceId, profileId);
    if (!existing || existing.status === "removed") return { success: false, error: "member_not_found" };
    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", profileId).maybeSingle();
    if (profileError) return { success: false, error: "database_error" };
    if (profile?.role === "owner") return { success: false, error: "cannot_modify_owner" };
    if (existing.role === "admin" && !(await hasAnotherActiveAdmin(spaceId, profileId))) {
      return { success: false, error: "last_admin_required" };
    }
    const { error } = await supabase
      .from("space_members")
      .update({ status: "removed" })
      .eq("id", existing.id)
      .eq("status", "active");
    if (error) return { success: false, error: "database_error" };
    return { success: true };
  } catch {
    return { success: false, error: "forbidden" };
  }
}
