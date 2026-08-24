import { isOwner } from "@/src/lib/auth/rbac";
import { authorizeOrganizationAdmin, authorizeOrganizationMember, getAccessibleOrganizations } from "@/src/lib/spaces/access";
import type { AuthenticatedUser } from "@/src/types/auth";
import type { Database, OrganizationMemberRole, OrganizationMemberStatus } from "@/src/types/database";
import type { AccessibleOrganization, OrganizationMember, Space } from "@/src/types/space";
import { createAdminClient } from "@/utils/supabase/admin";

const MAX_ORGANIZATIONS = 100;
const MAX_ORGANIZATION_SPACES = 100;
const MAX_ORGANIZATION_MEMBERS = 500;

const SPACE_FIELDS = "id, organization_id, name, slug, clickup_workspace_id, clickup_space_id, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, created_by, settings, archived_at, created_at, updated_at";
const MEMBER_FIELDS = "id, organization_id, profile_id, role, status, joined_at, created_at, updated_at";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type OrganizationMemberRow = Database["public"]["Tables"]["organization_members"]["Row"];

type ProfileSummary = {
  id: string;
  clickup_user_id: string | null;
  name: string | null;
  email: string;
  role: AuthenticatedUser["role"];
  is_active: boolean;
  last_seen_at: string | null;
};

export interface OrganizationMemberView extends OrganizationMember {
  profile: ProfileSummary;
}

export type OrganizationMutationError =
  | "forbidden"
  | "member_not_found"
  | "membership_exists"
  | "invalid_role"
  | "cannot_modify_owner"
  | "cannot_modify_self"
  | "last_admin_required"
  | "database_error";

function toSpace(row: SpaceRow): Space {
  const settings = row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
    ? row.settings as Record<string, unknown>
    : {};
  return { ...row, settings };
}

function toMember(row: OrganizationMemberRow): OrganizationMember {
  return row;
}

export async function listOrganizationsForUser(user: AuthenticatedUser): Promise<AccessibleOrganization[]> {
  return (await getAccessibleOrganizations(user)).slice(0, MAX_ORGANIZATIONS);
}

export async function getOrganizationForUser(organizationId: string, user: AuthenticatedUser) {
  return authorizeOrganizationMember(organizationId, user);
}

export async function listOrganizationSpaces(organizationId: string, user: AuthenticatedUser): Promise<Space[] | null> {
  try {
    const access = await authorizeOrganizationMember(organizationId, user);
    const supabase = createAdminClient();
    let query = supabase
      .from("spaces")
      .select(SPACE_FIELDS)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_ORGANIZATION_SPACES);
    if (!access.is_platform_owner && access.membership?.role !== "admin") {
      const { data: directMemberships, error: directMembershipError } = await supabase
        .from("space_members")
        .select("space_id")
        .eq("profile_id", user.id)
        .eq("status", "active")
        .limit(MAX_ORGANIZATION_SPACES);
      if (directMembershipError) return null;
      const permittedSpaceIds = (directMemberships ?? []).map((membership) => membership.space_id);
      if (permittedSpaceIds.length === 0) return [];
      query = query.in("id", permittedSpaceIds);
    }
    const { data, error } = await query;
    if (error || !data) return null;
    return data.map(toSpace);
  } catch {
    return null;
  }
}

export async function listOrganizationMembers(organizationId: string, user: AuthenticatedUser): Promise<OrganizationMemberView[] | null> {
  try {
    await authorizeOrganizationAdmin(organizationId, user);
    const supabase = createAdminClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("organization_members")
      .select(MEMBER_FIELDS)
      .eq("organization_id", organizationId)
      .neq("status", "removed")
      .order("created_at", { ascending: true })
      .limit(MAX_ORGANIZATION_MEMBERS);
    if (membershipError || !memberships) return null;
    if (memberships.length === 0) return [];

    const profileIds = memberships.map((membership) => membership.profile_id);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, clickup_user_id, name, email, role, is_active, last_seen_at")
      .in("id", profileIds)
      .limit(MAX_ORGANIZATION_MEMBERS);
    if (profileError || !profiles) return null;
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    return memberships.flatMap((membership) => {
      const profile = profilesById.get(membership.profile_id);
      return profile ? [{ ...toMember(membership), profile }] : [];
    });
  } catch {
    return null;
  }
}

async function loadMember(organizationId: string, profileId: string): Promise<OrganizationMemberRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(MEMBER_FIELDS)
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return error || !data ? null : data;
}

async function hasAnotherActiveAdmin(organizationId: string, excludedProfileId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "admin")
    .eq("status", "active")
    .neq("profile_id", excludedProfileId);
  return !error && (count ?? 0) > 0;
}

export async function addOrganizationMember(
  organizationId: string,
  user: AuthenticatedUser,
  profileId: string,
  role: unknown,
): Promise<{ success: true; member: OrganizationMemberView } | { success: false; error: OrganizationMutationError }> {
  if (role !== "admin" && role !== "member") return { success: false, error: "invalid_role" };
  try {
    await authorizeOrganizationAdmin(organizationId, user);
    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, clickup_user_id, name, email, role, is_active, last_seen_at")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError) return { success: false, error: "database_error" };
    if (!profile || !profile.is_active) return { success: false, error: "member_not_found" };
    if (profile.role === "owner") return { success: false, error: "cannot_modify_owner" };
    const existing = await loadMember(organizationId, profileId);
    if (existing?.status === "active") return { success: false, error: "membership_exists" };
    const { data: member, error: memberError } = existing
      ? await supabase.from("organization_members").update({ role: role as OrganizationMemberRole, status: "active" as OrganizationMemberStatus, joined_at: new Date().toISOString() }).eq("id", existing.id).select(MEMBER_FIELDS).single()
      : await supabase.from("organization_members").insert({ organization_id: organizationId, profile_id: profileId, role: role as OrganizationMemberRole, status: "active" as OrganizationMemberStatus, joined_at: new Date().toISOString() }).select(MEMBER_FIELDS).single();
    if (memberError || !member) return { success: false, error: "database_error" };
    return { success: true, member: { ...toMember(member), profile } };
  } catch {
    return { success: false, error: "forbidden" };
  }
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  user: AuthenticatedUser,
  profileId: string,
  role: unknown,
): Promise<{ success: true; member: OrganizationMemberView } | { success: false; error: OrganizationMutationError }> {
  if (role !== "admin" && role !== "member") return { success: false, error: "invalid_role" };
  if (profileId === user.id) return { success: false, error: "cannot_modify_self" };
  try {
    await authorizeOrganizationAdmin(organizationId, user);
    const existing = await loadMember(organizationId, profileId);
    if (!existing || existing.status === "removed") return { success: false, error: "member_not_found" };
    if (existing.role === "admin" && role === "member" && !(await hasAnotherActiveAdmin(organizationId, profileId))) {
      return { success: false, error: "last_admin_required" };
    }
    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, clickup_user_id, name, email, role, is_active, last_seen_at")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError) return { success: false, error: "database_error" };
    if (!profile) return { success: false, error: "member_not_found" };
    if (profile.role === "owner") return { success: false, error: "cannot_modify_owner" };
    const { data: member, error: updateError } = await supabase.from("organization_members").update({ role: role as OrganizationMemberRole }).eq("id", existing.id).select(MEMBER_FIELDS).single();
    if (updateError || !member) return { success: false, error: "database_error" };
    return { success: true, member: { ...toMember(member), profile } };
  } catch {
    return { success: false, error: "forbidden" };
  }
}

export async function removeOrganizationMember(
  organizationId: string,
  user: AuthenticatedUser,
  profileId: string,
): Promise<{ success: true } | { success: false; error: OrganizationMutationError }> {
  if (profileId === user.id) return { success: false, error: "cannot_modify_self" };
  try {
    await authorizeOrganizationAdmin(organizationId, user);
    const existing = await loadMember(organizationId, profileId);
    if (!existing || existing.status === "removed") return { success: false, error: "member_not_found" };
    if (existing.role === "admin" && !(await hasAnotherActiveAdmin(organizationId, profileId))) return { success: false, error: "last_admin_required" };
    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", profileId).maybeSingle();
    if (profileError) return { success: false, error: "database_error" };
    if (profile?.role === "owner") return { success: false, error: "cannot_modify_owner" };
    const { error } = await supabase.from("organization_members").update({ status: "removed" as OrganizationMemberStatus }).eq("id", existing.id).eq("status", "active");
    if (error) return { success: false, error: "database_error" };
    return { success: true };
  } catch {
    return { success: false, error: "forbidden" };
  }
}

export function isOrganizationOwner(user: AuthenticatedUser): boolean {
  return isOwner(user.role);
}
