/**
 * TrackUp Server-Side Session Utilities
 *
 * All functions in this file run exclusively on the server (Route Handlers,
 * Server Components, Server Actions). They read identity from the trusted
 * HTTP-only `trackup_user` cookie that was set during the OAuth callback and
 * cross-validate the role from the database – never from the cookie alone.
 *
 * Exports:
 *   getCurrentUser()      – returns AuthenticatedUser | null
 *   getCurrentProfile()   – returns Profile | null  (fresh DB row)
 *   getCurrentRole()      – returns UserRole | null
 *   hasRole()             – boolean check against the DB role
 *   hasPermission()       – boolean permission check
 *   requireAuth()         – throws AuthError if not authenticated
 *   requireRole()         – throws AuthError if role insufficient
 *   requirePermission()   – throws AuthError if permission missing
 */

import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  isValidRole,
  type AuthenticatedUser,
  type Profile,
  type UserRole,
} from "@/src/types/auth";
import {
  roleHasPermission,
  hasMinimumRole,
  ROLE_HIERARCHY,
} from "@/src/lib/auth/rbac";
import type { Permission } from "@/src/types/permissions";
import { verifySignedSessionCookie } from "@/src/lib/auth/session-cookie";

// ---------------------------------------------------------------------------
// Internal error type
// ---------------------------------------------------------------------------

export type AuthErrorCode =
  | "unauthenticated"
  | "inactive_account"
  | "invalid_role"
  | "missing_profile"
  | "forbidden"
  | "database_error";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

import { validateSession } from "./session-store";
import { SESSION_COOKIE_NAME } from "./session-token";

// ---------------------------------------------------------------------------
// Primary utilities
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user by:
 * 1. Validating the native trackup_session against the database session store.
 * 2. Or falling back to verifying the signed session cookie and fetching the DB profile.
 * 3. Checking live is_active and valid role in all cases.
 *
 * Returns null when not authenticated, profile is missing, role is invalid,
 * or the account is inactive.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();

  // 1. Try native database session
  const nativeToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (nativeToken) {
    const sessionResult = await validateSession(nativeToken);
    if (sessionResult) {
      return sessionResult.user;
    }
  }

  // 2. Fallback to legacy cookie if present
  const legacyRaw = cookieStore.get("trackup_user")?.value;
  if (!legacyRaw) return null;

  const session = await verifySignedSessionCookie(legacyRaw);
  if (!session) return null;

  try {
    const supabase = createAdminClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.id)
      .maybeSingle();

    if (error || !profile) return null;
    if (!profile.is_active) return null;
    if (!isValidRole(profile.role)) return null;

    return {
      id: profile.id,
      username: profile.username ?? null,
      email: profile.email,
      role: profile.role,
      is_active: profile.is_active,
      name: profile.name,
    };
  } catch {
    return null;
  }
}

/**
 * Returns the full Profile row from the database for the current session.
 * Validates active status and role. Returns null on any failure.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const supabase = createAdminClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) return null;
    if (!profile.is_active) return null;
    if (!isValidRole(profile.role)) return null;

    return profile as Profile;
  } catch {
    return null;
  }
}

/**
 * Returns only the role of the current user from the DB.
 * Returns null when unauthenticated, inactive, or role is invalid.
 */
export async function getCurrentRole(): Promise<UserRole | null> {
  const user = await getCurrentUser();
  return user?.role ?? null;
}

// ---------------------------------------------------------------------------
// Boolean checks (non-throwing)
// ---------------------------------------------------------------------------

/**
 * Returns true if the current session user holds exactly `role`
 * or a role that is higher in the hierarchy.
 */
export async function hasRole(minimumRole: UserRole): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return hasMinimumRole(user.role, minimumRole);
}

/**
 * Returns true if the current session user's DB role grants `permission`.
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return roleHasPermission(user.role, permission);
}

// ---------------------------------------------------------------------------
// Guard utilities (throwing)
// ---------------------------------------------------------------------------

/**
 * Asserts the current request is authenticated and the account is active.
 * Throws AuthError("unauthenticated") or AuthError("inactive_account") otherwise.
 * Returns the AuthenticatedUser so callers don't need a second call.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("unauthenticated", "Authentication required");
  }

  if (!user.is_active) {
    throw new AuthError("inactive_account", "Account is inactive");
  }

  if (!isValidRole(user.role)) {
    throw new AuthError("invalid_role", "User profile has an unrecognised role");
  }

  return user;
}

/**
 * Asserts the current user holds at least `minimumRole` in the hierarchy.
 * Throws AuthError("unauthenticated") or AuthError("forbidden") otherwise.
 * Returns the AuthenticatedUser on success.
 */
export async function requireRole(minimumRole: UserRole): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw new AuthError(
      "forbidden",
      `Role '${user.role}' does not meet the required role '${minimumRole}'`
    );
  }

  return user;
}

/**
 * Asserts the current user's DB role grants `permission`.
 * Throws AuthError("unauthenticated") or AuthError("forbidden") otherwise.
 * Returns the AuthenticatedUser on success.
 */
export async function requirePermission(permission: Permission): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!roleHasPermission(user.role, permission)) {
    throw new AuthError(
      "forbidden",
      `Role '${user.role}' does not have permission '${permission}'`
    );
  }

  return user;
}
