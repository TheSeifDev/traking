import { isOwner } from "@/src/lib/auth/rbac";
import { AuthError } from "@/src/lib/auth/session";
import type { AuthenticatedUser } from "@/src/types/auth";
import { createAdminClient } from "@/utils/supabase/admin";

export type ContentResource = {
  organization_id: string;
  space_id: string | null;
};

/**
 * VISIBILITY RULE:
 * 1. Platform OWNER has global access across all organizations and teams.
 * 2. Regular user must be an active member of resource.organization_id.
 * 3. If resource.space_id IS NULL:
 *    Resource is Organization-wide -> Accessible to any active member of the Organization.
 * 4. If resource.space_id IS NOT NULL:
 *    Resource is Team-specific -> Accessible ONLY if the user has active membership in that Team/Space
 *    (or has active Organization Admin role).
 */
export async function canUserAccessContent(
  user: AuthenticatedUser,
  content: ContentResource,
): Promise<boolean> {
  if (isOwner(user.role)) return true;
  if (!user.id || !content.organization_id) return false;

  const supabase = createAdminClient();

  // 1. Verify user belongs to the organization
  const { data: orgMember, error: orgError } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", content.organization_id)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (orgError || !orgMember) return false;

  // 2. If resource.space_id IS NULL: allow if organization membership is valid
  if (content.space_id === null) return true;

  // 3. If resource.space_id IS NOT NULL: allow only if user has active membership in that team/space
  const { data: spaceMember, error: spaceError } = await supabase
    .from("space_members")
    .select("role, status")
    .eq("space_id", content.space_id)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (spaceError || !spaceMember) return false;

  return true;
}

/**
 * Asserts content access; throws an AuthError('forbidden') if not accessible.
 */
export async function authorizeContentAccess(
  user: AuthenticatedUser,
  content: ContentResource,
): Promise<void> {
  const allowed = await canUserAccessContent(user, content);
  if (!allowed) {
    throw new AuthError("forbidden", "You do not have access to this resource.");
  }
}

/**
 * Retrieves the set of Space/Team IDs within an organization that the user is actively a member of.
 */
export async function getUserAccessibleSpaceIds(
  user: AuthenticatedUser,
  organizationId: string,
): Promise<string[] | "ALL"> {
  if (isOwner(user.role)) return "ALL";

  const supabase = createAdminClient();

  // Check organization membership
  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!orgMember) return [];

  // Fetch active team space memberships
  const { data: spaceMemberships } = await supabase
    .from("space_members")
    .select("space_id, spaces!inner(organization_id, archived_at)")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .eq("spaces.organization_id", organizationId)
    .is("spaces.archived_at", null);

  if (!spaceMemberships) return [];
  return spaceMemberships.map((sm) => sm.space_id);
}
