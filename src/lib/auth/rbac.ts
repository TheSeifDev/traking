/**
 * TrackUp Server-Side RBAC Core
 *
 * This module owns:
 * - Role hierarchy
 * - Definitive role → permission mapping (single source of truth)
 * - Role/permission predicate helpers
 * - Owner-email detection for initial provisioning
 *
 * NEVER scatter `if (role === "admin")` logic outside this module.
 * All authorization decisions should call into these utilities.
 */

import { USER_ROLES, type UserRole } from "@/src/types/auth";
import { PERMISSIONS, type Permission } from "@/src/types/permissions";

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

/**
 * Numeric levels used for hasMinimumRole comparisons.
 * owner (3) > admin (2) > viewer (1)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [USER_ROLES.OWNER]: 3,
  [USER_ROLES.ADMIN]: 2,
  [USER_ROLES.VIEWER]: 1,
} as const;

// ---------------------------------------------------------------------------
// Definitive role → permission mapping  (single source of truth)
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  [USER_ROLES.OWNER]: new Set<Permission>([
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.VIDEOS_READ,
    PERMISSIONS.VIDEOS_CREATE,
    PERMISSIONS.VIDEOS_UPDATE,
    PERMISSIONS.VIDEOS_DELETE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ADMINS_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.SYSTEM_MANAGE,
  ]),

  [USER_ROLES.ADMIN]: new Set<Permission>([
    PERMISSIONS.VIDEOS_READ,
    PERMISSIONS.VIDEOS_CREATE,
    PERMISSIONS.VIDEOS_UPDATE,
    PERMISSIONS.VIDEOS_DELETE,
    PERMISSIONS.ANALYTICS_READ,
  ]),

  [USER_ROLES.VIEWER]: new Set<Permission>([
    PERMISSIONS.VIDEOS_READ,
    PERMISSIONS.ANALYTICS_READ,
  ]),
};

// ---------------------------------------------------------------------------
// Permission predicates
// ---------------------------------------------------------------------------

/**
 * Returns true if `role` grants `permission`.
 * This is the single centralized permission check.
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Returns true if `role` grants ALL of the listed permissions.
 */
export function roleHasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => roleHasPermission(role, p));
}

/**
 * Returns true if `role` grants ANY of the listed permissions.
 */
export function roleHasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => roleHasPermission(role, p));
}

/**
 * Returns the full set of permissions granted to a role.
 * Safe to iterate; returns an empty Set for unrecognised roles.
 */
export function getPermissionsForRole(role: UserRole): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS[role] ?? new Set();
}

// ---------------------------------------------------------------------------
// Role predicates
// ---------------------------------------------------------------------------

export function isOwner(role: UserRole): boolean {
  return role === USER_ROLES.OWNER;
}

export function isAdmin(role: UserRole): boolean {
  return role === USER_ROLES.ADMIN;
}

export function isAdminOrOwner(role: UserRole): boolean {
  return role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN;
}

export function isViewer(role: UserRole): boolean {
  return role === USER_ROLES.VIEWER;
}

/**
 * Returns true when the user's role is at least as privileged as `requiredRole`
 * according to the numeric hierarchy.
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

// ---------------------------------------------------------------------------
// Owner-email provisioning helpers  (server-side only)
// ---------------------------------------------------------------------------

/**
 * Returns true if `email` matches the server-side TRACKUP_OWNER_EMAIL variable
 * (case-insensitive, whitespace-trimmed).
 *
 * Must never be called from client components.
 */
export function isConfiguredOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const ownerEmail = process.env.TRACKUP_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return false;
  return email.trim().toLowerCase() === ownerEmail;
}

/**
 * Determines the initial role for a brand-new user.
 * 'owner' only if the email matches TRACKUP_OWNER_EMAIL; otherwise 'viewer'.
 * Users can never choose their own role.
 */
export function determineInitialRole(email: string | null | undefined): UserRole {
  return isConfiguredOwnerEmail(email) ? USER_ROLES.OWNER : USER_ROLES.VIEWER;
}
