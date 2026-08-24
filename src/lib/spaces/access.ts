import { AuthError, requireAuth } from "@/src/lib/auth/session";
import { isOwner } from "@/src/lib/auth/rbac";
import type { AuthenticatedUser } from "@/src/types/auth";
import type { Database } from "@/src/types/database";
import type { AccessibleOrganization, AccessibleSpace, Organization, OrganizationAccess, OrganizationMember, Space, SpaceAccess, SpaceMember, SpaceRole } from "@/src/types/space";
import { createAdminClient } from "@/utils/supabase/admin";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type OrganizationMemberRow = Database["public"]["Tables"]["organization_members"]["Row"];
type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type SpaceMemberRow = Database["public"]["Tables"]["space_members"]["Row"];

const MAX_ACCESSIBLE_SPACES = 100;
const ORGANIZATION_FIELDS = "id, name, slug, clickup_workspace_id, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, created_by, settings, archived_at, created_at, updated_at";
const ORGANIZATION_MEMBER_FIELDS = "id, organization_id, profile_id, role, status, joined_at, created_at, updated_at";
const SPACE_FIELDS = "id, organization_id, name, slug, clickup_workspace_id, clickup_space_id, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, created_by, settings, archived_at, created_at, updated_at";

function toOrganization(row: OrganizationRow): Organization {
  const settings = row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
    ? row.settings as Record<string, unknown>
    : {};
  return { ...row, settings };
}

function toOrganizationMember(row: OrganizationMemberRow): OrganizationMember {
  return row;
}

function toSpace(row: SpaceRow): Space {
  const settings = row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
    ? row.settings as Record<string, unknown>
    : {};
  return { ...row, settings };
}

function toMember(row: SpaceMemberRow): SpaceMember {
  return row;
}

async function hydrateOrganizationWorkspaceIds<T extends Space>(spaces: T[]): Promise<T[]> {
  const organizationIds = [...new Set(spaces.filter((space) => !space.clickup_workspace_id).map((space) => space.organization_id))];
  if (organizationIds.length === 0) return spaces;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("organizations").select("id, clickup_workspace_id").in("id", organizationIds).limit(MAX_ACCESSIBLE_SPACES);
  if (error || !data) return spaces;
  const workspaceByOrganization = new Map(data.map((organization) => [organization.id, organization.clickup_workspace_id]));
  return spaces.map((space) => {
    const workspaceId = workspaceByOrganization.get(space.organization_id);
    return space.clickup_workspace_id || !workspaceId ? space : Object.assign({}, space, { clickup_workspace_id: workspaceId });
  });
}

function denied(message = "Space access denied"): AuthError {
  return new AuthError("forbidden", message);
}

export async function getSpaceById(spaceId: string): Promise<Space | null> {
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spaces")
    .select(SPACE_FIELDS)
    .eq("id", spaceId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return toSpace(data);
}

async function getOrganizationById(organizationId: string): Promise<Organization | null> {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(ORGANIZATION_FIELDS)
    .eq("id", organizationId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return toOrganization(data);
}

async function loadOrganizationMembership(profileId: string, organizationId: string): Promise<OrganizationMember | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(ORGANIZATION_MEMBER_FIELDS)
    .eq("profile_id", profileId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return toOrganizationMember(data);
}

export async function getAccessibleOrganizations(user: AuthenticatedUser): Promise<AccessibleOrganization[]> {
  const supabase = createAdminClient();
  if (isOwner(user.role)) {
    const { data, error } = await supabase
      .from("organizations")
      .select(ORGANIZATION_FIELDS)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_ACCESSIBLE_SPACES);
    if (error || !data) return [];
    return data.map((row) => ({ ...toOrganization(row), membership_role: null, membership_status: null, is_platform_owner: true }));
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select(ORGANIZATION_MEMBER_FIELDS)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(MAX_ACCESSIBLE_SPACES);
  if (membershipError || !memberships || memberships.length === 0) return [];

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select(ORGANIZATION_FIELDS)
    .in("id", organizationIds)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(MAX_ACCESSIBLE_SPACES);
  if (organizationError || !organizations) return [];

  const membershipByOrganization = new Map(memberships.map((membership) => [membership.organization_id, membership]));
  return organizations.map((organization) => {
    const membership = membershipByOrganization.get(organization.id);
    return {
      ...toOrganization(organization),
      membership_role: membership?.role ?? null,
      membership_status: membership?.status ?? null,
      is_platform_owner: false,
    };
  });
}

export async function authorizeOrganizationMember(organizationId: string, user: AuthenticatedUser): Promise<OrganizationAccess> {
  const organization = await getOrganizationById(organizationId);
  if (!organization) throw denied("Organization access denied");
  if (isOwner(user.role)) {
    return { user, organization, membership: null, effective_role: user.role, is_platform_owner: true };
  }
  const membership = await loadOrganizationMembership(user.id, organization.id);
  if (!membership || membership.status !== "active") throw denied("Organization access denied");
  return { user, organization, membership, effective_role: membership.role, is_platform_owner: false };
}

export async function authorizeOrganizationAdmin(organizationId: string, user: AuthenticatedUser): Promise<OrganizationAccess> {
  const access = await authorizeOrganizationMember(organizationId, user);
  if (access.is_platform_owner || access.membership?.role === "admin") return access;
  throw denied("Organization admin access denied");
}

async function loadMembership(profileId: string, spaceId: string): Promise<SpaceMember | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("space_members")
    .select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at")
    .eq("profile_id", profileId)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (error || !data) return null;
  return toMember(data);
}

export async function getAccessibleSpaces(user: AuthenticatedUser): Promise<AccessibleSpace[]> {
  const supabase = createAdminClient();
  if (isOwner(user.role)) {
    const { data, error } = await supabase
      .from("spaces")
      .select(SPACE_FIELDS)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_ACCESSIBLE_SPACES);
    if (error || !data) return [];
    const spaces = data.map((row) => ({
      ...toSpace(row),
      membership_role: null,
      membership_status: null,
      is_platform_owner: true,
    }));
    return hydrateOrganizationWorkspaceIds(spaces);
  }

  const { data: organizationMemberships, error: organizationMembershipError } = await supabase
    .from("organization_members")
    .select(ORGANIZATION_MEMBER_FIELDS)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(MAX_ACCESSIBLE_SPACES);
  if (organizationMembershipError) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from("space_members")
    .select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(MAX_ACCESSIBLE_SPACES);
  if (membershipError) return [];

  const activeOrganizationIds = new Set((organizationMemberships ?? []).map((membership) => membership.organization_id));
  const organizationIds = new Set(
    (organizationMemberships ?? [])
      .filter((membership) => membership.role === "admin")
      .map((membership) => membership.organization_id),
  );
  const directSpaceIds = new Set((memberships ?? []).map((membership) => membership.space_id));
  const organizationSpaces = organizationIds.size > 0
    ? await supabase.from("spaces").select(SPACE_FIELDS).in("organization_id", [...organizationIds]).is("archived_at", null).limit(MAX_ACCESSIBLE_SPACES)
    : { data: [], error: null };
  if (organizationSpaces.error || !organizationSpaces.data) return [];

  const directSpaces = directSpaceIds.size > 0
    ? await supabase.from("spaces").select(SPACE_FIELDS).in("id", [...directSpaceIds]).is("archived_at", null).limit(MAX_ACCESSIBLE_SPACES)
    : { data: [], error: null };
  if (directSpaces.error || !directSpaces.data) return [];

  const directSpacesWithOrganizationAccess = directSpaces.data.filter((space) => activeOrganizationIds.has(space.organization_id));
  const allSpaces = [...organizationSpaces.data, ...directSpacesWithOrganizationAccess];
  const uniqueSpaces = [...new Map(allSpaces.map((space) => [space.id, space])).values()].sort((left, right) => left.created_at.localeCompare(right.created_at)).slice(0, MAX_ACCESSIBLE_SPACES);
  const membershipBySpace = new Map((memberships ?? []).map((membership) => [membership.space_id, membership]));
  const organizationMembershipByOrganization = new Map((organizationMemberships ?? []).map((membership) => [membership.organization_id, membership]));
  const spaces = uniqueSpaces.map((space) => {
    const membership = membershipBySpace.get(space.id);
    const organizationMembership = organizationMembershipByOrganization.get(space.organization_id);
    return {
      ...toSpace(space),
      membership_role: membership?.role ?? (organizationMembership?.role === "admin" ? "admin" : null),
      membership_status: membership?.status ?? (organizationMembership?.role === "admin" ? "active" : null),
      is_platform_owner: false,
    };
  });
  return hydrateOrganizationWorkspaceIds(spaces);
}

export async function getAccessibleSpaceIds(user: AuthenticatedUser): Promise<string[]> {
  const spaces = await getAccessibleSpaces(user);
  return spaces.map((space) => space.id);
}

export async function authorizeSpaceMember(spaceId: string, user: AuthenticatedUser): Promise<SpaceAccess> {
  const space = await getSpaceById(spaceId);
  if (!space) throw denied();

  const organization = await getOrganizationById(space.organization_id);
  if (!organization) throw denied();
  const resolvedSpace = space.clickup_workspace_id || !organization.clickup_workspace_id
    ? space
    : { ...space, clickup_workspace_id: organization.clickup_workspace_id };

  if (isOwner(user.role)) {
    return {
      user,
      organization,
      organization_membership: null,
      space: resolvedSpace,
      membership: null,
      effective_role: user.role,
      is_platform_owner: true,
    };
  }

  const [membership, organizationMembership] = await Promise.all([
    loadMembership(user.id, space.id),
    loadOrganizationMembership(user.id, organization.id),
  ]);
  const hasActiveOrganizationAccess = organizationMembership?.status === "active";
  const hasOrganizationAdminAccess = hasActiveOrganizationAccess && organizationMembership?.role === "admin";
  const hasActiveSpaceAccess = hasActiveOrganizationAccess && membership?.status === "active";
  if (!hasOrganizationAdminAccess && !hasActiveSpaceAccess) throw denied();
  return {
    user,
    organization,
    organization_membership: organizationMembership?.status === "active" ? organizationMembership : null,
    space: resolvedSpace,
    membership: hasActiveSpaceAccess ? membership : null,
    effective_role: hasActiveSpaceAccess ? membership.role : organizationMembership?.role ?? "member",
    is_platform_owner: false,
  };
}

export async function authorizeSpaceAdmin(spaceId: string, user: AuthenticatedUser): Promise<SpaceAccess> {
  const access = await authorizeSpaceMember(spaceId, user);
  if (access.is_platform_owner || access.membership?.role === "admin" || access.organization_membership?.role === "admin") return access;
  throw denied();
}

export async function requireSpaceMember(spaceId: string): Promise<SpaceAccess> {
  const user = await requireAuth();
  return authorizeSpaceMember(spaceId, user);
}

export async function requireSpaceAdmin(spaceId: string): Promise<SpaceAccess> {
  const user = await requireAuth();
  return authorizeSpaceAdmin(spaceId, user);
}

export async function getSingleAccessibleSpaceId(user: AuthenticatedUser): Promise<string | null> {
  const spaces = await getAccessibleSpaces(user);
  return spaces.length === 1 ? spaces[0]?.id ?? null : null;
}

export function readSpaceSelector(request: Request): string | null {
  const url = new URL(request.url);
  const value = url.searchParams.get("space_id") ?? url.searchParams.get("spaceId");
  return value?.trim() || null;
}

export async function requireSpaceMemberFromRequest(request: Request): Promise<SpaceAccess> {
  const user = await requireAuth();
  return resolveSpaceForUser(request, user);
}

export async function requireSpaceAdminFromRequest(request: Request): Promise<SpaceAccess> {
  const user = await requireAuth();
  return resolveSpaceAdminForUser(request, user);
}

export async function resolveSpaceForUser(request: Request, user: AuthenticatedUser): Promise<SpaceAccess> {
  const explicitSpaceId = readSpaceSelector(request);
  if (explicitSpaceId) return authorizeSpaceMember(explicitSpaceId, user);
  const fallbackSpaceId = await getSingleAccessibleSpaceId(user);
  if (!fallbackSpaceId) throw denied("Space selection required");
  return authorizeSpaceMember(fallbackSpaceId, user);
}

export async function resolveSpaceAdminForUser(request: Request, user: AuthenticatedUser): Promise<SpaceAccess> {
  const explicitSpaceId = readSpaceSelector(request);
  if (explicitSpaceId) return authorizeSpaceAdmin(explicitSpaceId, user);
  const fallbackSpaceId = await getSingleAccessibleSpaceId(user);
  if (!fallbackSpaceId) throw denied("Space selection required");
  return authorizeSpaceAdmin(fallbackSpaceId, user);
}

export function isSpaceRole(value: unknown): value is SpaceRole {
  return value === "admin" || value === "member";
}
