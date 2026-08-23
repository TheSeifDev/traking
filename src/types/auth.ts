/**
 * Shared TrackUp RBAC & Authentication Types
 * 
 * TrackUp has exactly 3 roles:
 * - owner: full access, system administration, billing, and role management
 * - admin: management of team, video trackers, and analytics
 * - viewer: read-only access to assigned videos and analytics
 */

export const USER_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  VIEWER: "viewer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ALL_USER_ROLES: readonly UserRole[] = [
  USER_ROLES.OWNER,
  USER_ROLES.ADMIN,
  USER_ROLES.VIEWER,
] as const;

/**
 * Type guard to check if an unknown value is a valid UserRole
 */
export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && (ALL_USER_ROLES as readonly string[]).includes(role);
}

/**
 * Roles that can be assigned through the role management system.
 * 'owner' is intentionally excluded — it is assigned only at provisioning time
 * server-side and can never be reassigned through any management operation.
 */
export const MANAGED_ROLES = {
  ADMIN: USER_ROLES.ADMIN,
  VIEWER: USER_ROLES.VIEWER,
} as const;

export type ManagedRole = (typeof MANAGED_ROLES)[keyof typeof MANAGED_ROLES];

/**
 * Type guard to check if an unknown value is a valid ManagedRole.
 * A ManagedRole is one that can be assigned through role management (NOT owner).
 */
export function isValidManagedRole(role: unknown): role is ManagedRole {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.VIEWER;
}


/**
 * Database representation of a User Profile
 */
export interface Profile {
  id: string;
  clickup_user_id: string | null;
  name: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked" | "not_invited";

export interface InvitationSummary {
  id: string;
  email: string;
  role: ManagedRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  last_sent_at: string | null;
  status: InvitationStatus;
}

export interface TeamMember extends Profile {
  invitation: InvitationSummary | null;
  invitation_status: InvitationStatus;
}

/**
 * Session representation of an Authenticated User
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  name: string | null;
  clickup_user_id: string | null;
}
