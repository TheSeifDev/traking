"use server";

/**
 * TrackUp Server Actions – Owner Role & Status Management
 *
 * All functions in this file carry the 'use server' directive.
 * They are the ONLY legitimate way to trigger role or status changes from
 * the application UI — all authorization is enforced inside role-management.ts.
 *
 * DO NOT read role values from:
 *   - FormData fields named "role" without server-side validation
 *   - URL search params
 *   - React state
 *   - cookies (except the trackup_user session cookie via requireAuth)
 *
 * Usage from a Server Component or Client Component:
 *
 *   import { changeUserRoleAction } from "@/app/actions/role-management";
 *   // Then call as a form action or inside startTransition
 */

import { changeUserRole, setUserActiveStatus } from "@/src/lib/auth/role-management";
import type { RoleChangeResult, StatusChangeResult } from "@/src/lib/auth/role-management";

// ---------------------------------------------------------------------------
// Role change action
// ---------------------------------------------------------------------------

/**
 * Server Action: change the role of a target user.
 *
 * @param targetUserId  - UUID of the profile to update (validated on server)
 * @param newRole       - Desired role — must be "admin" or "viewer".
 *                        If any other value is supplied, returns invalid_role.
 *
 * Returns a typed result object (never throws to the client).
 */
export async function changeUserRoleAction(
  targetUserId: string,
  newRole: unknown
): Promise<RoleChangeResult> {
  return changeUserRole(targetUserId, newRole);
}

// ---------------------------------------------------------------------------
// Status change action
// ---------------------------------------------------------------------------

/**
 * Server Action: activate or deactivate a user account.
 *
 * @param targetUserId  - UUID of the profile to update
 * @param isActive      - true to activate, false to deactivate
 *
 * Returns a typed result object (never throws to the client).
 * The owner's own account cannot be deactivated.
 */
export async function setUserActiveStatusAction(
  targetUserId: string,
  isActive: boolean
): Promise<StatusChangeResult> {
  return setUserActiveStatus(targetUserId, isActive);
}
