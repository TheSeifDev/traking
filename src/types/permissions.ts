/**
 * TrackUp Centralized Permission System
 *
 * All application permissions are defined here as string literals.
 * Adding a new permission = add it to this list + the ROLE_PERMISSIONS map.
 * Never scatter `if (role === "admin")` checks across the codebase.
 */

// ---------------------------------------------------------------------------
// Permission literals
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // User management
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",

  // Video management
  VIDEOS_READ: "videos.read",
  VIDEOS_CREATE: "videos.create",
  VIDEOS_UPDATE: "videos.update",
  VIDEOS_DELETE: "videos.delete",

  // Analytics
  ANALYTICS_READ: "analytics.read",

  // Administrative
  ADMINS_MANAGE: "admins.manage",
  SETTINGS_MANAGE: "settings.manage",
  SYSTEM_MANAGE: "system.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS) as Permission[];

/**
 * Type guard to check whether an unknown value is a valid Permission.
 */
export function isValidPermission(p: unknown): p is Permission {
  return typeof p === "string" && (ALL_PERMISSIONS as readonly string[]).includes(p);
}
