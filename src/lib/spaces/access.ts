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
const ORGANIZATION_FIELDS = "id, name, slug, created_by, settings, archived_at, created_at, updated_at";
const ORGANIZATION_MEMBER_FIELDS = "id, organization_id, profile_id, role, status, joined_at, created_at, updated_at";
const SPACE_FIELDS = "id, organization_id, name, slug, created_by, settings, archived_at, created_at, updated_at";

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
      .order("name", { ascending: true })
      .limit(MAX_ACCESSIBLE_SPACES);
    if (error || !data) return [];
    return data.map((organization) => ({
      ...toOrganization(organization),
      membership_role: null,
      membership_status: null,
      is_platform_owner: true,
    }));
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select(`role, status, organization:organizations(${ORGANIZATION_FIELDS})`)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(MAX_ACCESSIBLE_SPACES);
  if (error || !data) return [];

  return data.flatMap((entry) => {
    const organization = entry.organization as unknown as OrganizationRow | null;
    if (!organization || organization.archived_at) return [];
    return [{
      ...toOrganization(organization),
      membership_role: entry.role,
      membership_status: entry.status,
      is_platform_owner: false,
    }];
  });
}

export async function authorizeOrganizationAdmin(organizationId: string, user: AuthenticatedUser): Promise<OrganizationAccess> {
  const access = await authorizeOrganizationMember(organizationId, user);
  if (access.is_platform_owner || access.membership?.role === "admin") return access;
  throw denied("Organization admin access required");
}

export async function authorizeOrganizationMember(organizationId: string, user: AuthenticatedUser): Promise<OrganizationAccess> {
  const organization = await getOrganizationById(organizationId);
  if (!organization) throw denied("Organization not found");

  if (isOwner(user.role)) {
    return {
      user,
      organization,
      membership: null,
      effective_role: user.role,
      is_platform_owner: true,
    };
  }

  const membership = await loadOrganizationMembership(user.id, organizationId);
  if (!membership || membership.status !== "active") throw denied("Organization membership required");

  return {
    user,
    organization,
    membership,
    effective_role: membership.role,
    is_platform_owner: false,
  };
}

export async function getAccessibleSpaces(user: AuthenticatedUser): Promise<AccessibleSpace[]> {
  const supabase = createAdminClient();

  if (isOwner(user.role)) {
    const { data, error } = await supabase
      .from("spaces")
      .select(SPACE_FIELDS)
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(MAX_ACCESSIBLE_SPACES);
    if (error || !data) return [];
    return data.map((space) => ({
      ...toSpace(space),
      membership_role: null,
      membership_status: null,
      is_platform_owner: true,
    }));
  }

  const [{ data: spaceMemberships, error: spaceMembershipError }, { data: organizationMemberships, error: organizationMembershipError }] = await Promise.all([
    supabase
      .from("space_members")
      .select(`role, status, space:spaces(${SPACE_FIELDS})`)
      .eq("profile_id", user.id)
      .eq("status", "active")
      .limit(MAX_ACCESSIBLE_SPACES),
    supabase
      .from("organization_members")
      .select("organization_id, role, status")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .limit(MAX_ACCESSIBLE_SPACES),
  ]);

  if (spaceMembershipError || organizationMembershipError) return [];

  const organizationRoleById = new Map((organizationMemberships ?? []).map((membership) => [membership.organization_id, membership.role]));
  const spacesById = new Map<string, AccessibleSpace>();

  for (const entry of spaceMemberships ?? []) {
    const space = entry.space as unknown as SpaceRow | null;
    if (!space || space.archived_at) continue;
    if (!organizationRoleById.has(space.organization_id)) continue;
    spacesById.set(space.id, {
      ...toSpace(space),
      membership_role: entry.role,
      membership_status: entry.status,
      is_platform_owner: false,
    });
  }

  const adminOrganizationIds = (organizationMemberships ?? [])
    .filter((membership) => membership.role === "admin")
    .map((membership) => membership.organization_id);

  if (adminOrganizationIds.length > 0) {
    const { data: organizationSpaces, error: organizationSpacesError } = await supabase
      .from("spaces")
      .select(SPACE_FIELDS)
      .in("organization_id", adminOrganizationIds)
      .is("archived_at", null)
      .limit(MAX_ACCESSIBLE_SPACES);
    if (!organizationSpacesError && organizationSpaces) {
      for (const space of organizationSpaces) {
        if (!spacesById.has(space.id)) {
          spacesById.set(space.id, {
            ...toSpace(space),
            membership_role: null,
            membership_status: null,
            is_platform_owner: false,
          });
        }
      }
    }
  }

  return [...spacesById.values()];
}

async function loadMembership(profileId: string, spaceId: string): Promise<SpaceMember | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("space_members")
    .select("id, space_id, profile_id, role, status, joined_at, created_at, updated_at")
    .eq("profile_id", profileId)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (error || !data) return null;
  return toMember(data);
}

export async function authorizeSpaceMember(spaceId: string, user: AuthenticatedUser): Promise<SpaceAccess> {
  const space = await getSpaceById(spaceId);
  if (!space) throw denied("Space not found");
  const organization = await getOrganizationById(space.organization_id);
  if (!organization) throw denied("Space organization not found");

  if (isOwner(user.role)) {
    return {
      user,
      organization,
      organization_membership: null,
      space,
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
    space,
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

export type MutationScope = {
  organizationId: string;
  spaceId: string | null;
  isPlatformOwner: boolean;
};

/**
 * Resolves the authorized mutation scope from a request.
 * Supports explicit space_id or organization_id (for virtual All Spaces).
 */
export async function resolveMutationScopeForUser(request: Request, user: AuthenticatedUser): Promise<MutationScope> {
  const url = new URL(request.url);
  const spaceId = url.searchParams.get("space_id")?.trim() || url.searchParams.get("spaceId")?.trim() || null;
  const organizationId = url.searchParams.get("organization_id")?.trim() || url.searchParams.get("organizationId")?.trim() || null;

  if (spaceId) {
    const access = await authorizeSpaceAdmin(spaceId, user);
    if (organizationId && access.space.organization_id !== organizationId) throw denied("Organization and Space scope mismatch");
    return {
      organizationId: access.space.organization_id,
      spaceId: access.space.id,
      isPlatformOwner: access.is_platform_owner,
    };
  }

  if (organizationId && isOwner(user.role)) {
    const access = await authorizeOrganizationAdmin(organizationId, user);
    return {
      organizationId: access.organization.id,
      spaceId: null,
      isPlatformOwner: true,
    };
  }

  // Fallback to single accessible space if no explicit scope provided
  const fallbackSpaceId = await getSingleAccessibleSpaceId(user);
  if (fallbackSpaceId) {
    const access = await authorizeSpaceAdmin(fallbackSpaceId, user);
    return {
      organizationId: access.space.organization_id,
      spaceId: access.space.id,
      isPlatformOwner: access.is_platform_owner,
    };
  }

  throw denied("Authorized scope selection required");
}

export function isSpaceRole(value: unknown): value is SpaceRole {
  return value === "admin" || value === "member";
}
