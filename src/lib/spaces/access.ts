import { AuthError, requireAuth } from "@/src/lib/auth/session";
import { isOwner } from "@/src/lib/auth/rbac";
import type { AuthenticatedUser } from "@/src/types/auth";
import type { Database } from "@/src/types/database";
import type { AccessibleSpace, Space, SpaceAccess, SpaceMember, SpaceRole } from "@/src/types/space";
import { createAdminClient } from "@/utils/supabase/admin";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type SpaceMemberRow = Database["public"]["Tables"]["space_members"]["Row"];

const MAX_ACCESSIBLE_SPACES = 100;

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
    .select("id, name, slug, clickup_workspace_id, created_by, settings, archived_at, created_at, updated_at")
    .eq("id", spaceId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return toSpace(data);
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
      .select("id, name, slug, clickup_workspace_id, created_by, settings, archived_at, created_at, updated_at")
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_ACCESSIBLE_SPACES);
    if (error || !data) return [];
    return data.map((row) => ({
      ...toSpace(row),
      membership_role: null,
      membership_status: null,
      is_platform_owner: true,
    }));
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("space_members")
    .select("id, space_id, profile_id, role, status, joined_at, source, clickup_user_id, last_synced_at, created_at, updated_at")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(MAX_ACCESSIBLE_SPACES);
  if (membershipError || !memberships || memberships.length === 0) return [];

  const spaceIds = memberships.map((membership) => membership.space_id);
  const { data: spaces, error: spaceError } = await supabase
    .from("spaces")
    .select("id, name, slug, clickup_workspace_id, created_by, settings, archived_at, created_at, updated_at")
    .in("id", spaceIds)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(MAX_ACCESSIBLE_SPACES);
  if (spaceError || !spaces) return [];

  const membershipBySpace = new Map(memberships.map((membership) => [membership.space_id, membership]));
  return spaces.map((space) => {
    const membership = membershipBySpace.get(space.id);
    return {
      ...toSpace(space),
      membership_role: membership?.role ?? null,
      membership_status: membership?.status ?? null,
      is_platform_owner: false,
    };
  });
}

export async function getAccessibleSpaceIds(user: AuthenticatedUser): Promise<string[]> {
  const spaces = await getAccessibleSpaces(user);
  return spaces.map((space) => space.id);
}

export async function authorizeSpaceMember(spaceId: string, user: AuthenticatedUser): Promise<SpaceAccess> {
  const space = await getSpaceById(spaceId);
  if (!space) throw denied();

  if (isOwner(user.role)) {
    return {
      user,
      space,
      membership: null,
      effective_role: user.role,
      is_platform_owner: true,
    };
  }

  const membership = await loadMembership(user.id, space.id);
  if (!membership || membership.status !== "active") throw denied();
  return {
    user,
    space,
    membership,
    effective_role: membership.role,
    is_platform_owner: false,
  };
}

export async function authorizeSpaceAdmin(spaceId: string, user: AuthenticatedUser): Promise<SpaceAccess> {
  const access = await authorizeSpaceMember(spaceId, user);
  if (access.is_platform_owner || access.membership?.role === "admin") return access;
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
