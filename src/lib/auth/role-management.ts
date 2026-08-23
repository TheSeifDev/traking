/**
 * TrackUp Owner-Only Role Management Logic
 *
 * This module owns ALL validation for role changes and account status changes.
 * It is the single source of truth for:
 *
 *   - What role transitions are allowed
 *   - Who can perform them
 *   - What constitutes a protected account (owner)
 *
 * Allowed transitions:
 *   viewer → admin   ✓
 *   admin  → viewer  ✓
 *
 * Blocked transitions (all others):
 *   *      → owner   ✗  (owner can never be assigned through management)
 *   owner  → *       ✗  (owner cannot be demoted)
 *   self   → *       ✗  (self-modification is never permitted)
 *
 * NEVER accept a role value from:
 *   - localStorage
 *   - cookies
 *   - React state
 *   - URL parameters
 *
 * Always validate against isValidManagedRole() before writing to the database.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAuth, AuthError } from "@/src/lib/auth/session";
import {
  USER_ROLES,
  isValidManagedRole,
  isValidRole,
  type ManagedRole,
  type Profile,
} from "@/src/types/auth";
import { isAdminOrOwner } from "./rbac";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type RoleChangeSuccess = {
  success: true;
  userId: string;
  previousRole: string;
  newRole: ManagedRole;
};

export type RoleChangeFailure = {
  success: false;
  error:
    | "unauthenticated"
    | "inactive_account"
    | "forbidden"          // requester is not owner
    | "self_modification"  // requester is trying to modify their own role
    | "target_not_found"
    | "target_is_owner"    // target user is the owner — never modifiable
    | "invalid_role"       // requested role is not a valid managed role
    | "no_change"          // new role is same as current role
    | "database_error";
};

export type RoleChangeResult = RoleChangeSuccess | RoleChangeFailure;

export type StatusChangeSuccess = {
  success: true;
  userId: string;
  is_active: boolean;
};

export type StatusChangeFailure = {
  success: false;
  error:
    | "unauthenticated"
    | "inactive_account"
    | "forbidden"
    | "self_modification"
    | "target_not_found"
    | "target_is_owner"
    | "database_error";
};

export type StatusChangeResult = StatusChangeSuccess | StatusChangeFailure;

// ---------------------------------------------------------------------------
// Core role change operation
// ---------------------------------------------------------------------------

/**
 * Changes the role of a target user.
 *
 * Full server-side authorization chain:
 *  1. Requester is authenticated (session cookie → DB profile)
 *  2. Requester's account is active
 *  3. Requester is the owner
 *  4. Target user exists
 *  5. Target user is not the owner
 *  6. Requester is not modifying themselves
 *  7. Requested role is a valid managed role (admin or viewer only)
 *  8. Requested role differs from target's current role
 *
 * @param targetUserId - UUID of the profile to update (comes from the server, never trusted from a URL param directly)
 * @param requestedRole - The new role. Must be "admin" or "viewer". Never "owner".
 */
export async function changeUserRole(
  targetUserId: string,
  requestedRole: unknown
): Promise<RoleChangeResult> {
  // ── 1 & 2: Authenticate requester via DB ────────────────────────────────
  let requester;
  try {
    requester = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === "inactive_account") return { success: false, error: "inactive_account" };
      return { success: false, error: "unauthenticated" };
    }
    return { success: false, error: "unauthenticated" };
  }

  // ── 3: Requester must be owner ──────────────────────────────────────────
  if (!isAdminOrOwner(requester.role)) {
    return { success: false, error: "forbidden" };
  }

  // ── 4: Validate requested role before any DB call ───────────────────────
  // Never trust the client's role value. isValidManagedRole excludes 'owner'.
  if (!isValidManagedRole(requestedRole)) {
    return { success: false, error: "invalid_role" };
  }

  const newRole: ManagedRole = requestedRole;

  // ── 5: Self-modification check ──────────────────────────────────────────
  if (targetUserId === requester.id) {
    return { success: false, error: "self_modification" };
  }

  try {
    const supabase = createAdminClient();

    // ── 6: Fetch target profile ────────────────────────────────────────────
    const { data: target, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, role, is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (fetchError || !target) {
      return { success: false, error: "target_not_found" };
    }

    // ── 7: Target must not be the owner ────────────────────────────────────
    if (target.role === USER_ROLES.OWNER) {
      return { success: false, error: "target_is_owner" };
    }

    // ── 8: No-op guard — role must actually change ─────────────────────────
    if (target.role === newRole) {
      return { success: false, error: "no_change" };
    }

    const previousRole = target.role;

    // ── 9: Persist the role change ──────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", targetUserId);

    if (updateError) {
      return { success: false, error: "database_error" };
    }

    // ── 10: Write audit record ──────────────────────────────────────────────
    // Fire-and-forget: audit failure must never block the successful operation.
    void supabase.from("role_change_audit").insert({
      target_user_id: targetUserId,
      changed_by_user_id: requester.id,
      previous_role: previousRole,
      new_role: newRole,
    });

    return {
      success: true,
      userId: targetUserId,
      previousRole,
      newRole,
    };
  } catch {
    return { success: false, error: "database_error" };
  }
}

// ---------------------------------------------------------------------------
// Active status change operation
// ---------------------------------------------------------------------------

/**
 * Activates or deactivates a user account.
 *
 * Authorization rules:
 *  - Only the owner can change account status.
 *  - The owner's own account can never be deactivated.
 *  - The owner account can never be deactivated (target_is_owner guard).
 *
 * @param targetUserId  - UUID of the profile to update
 * @param isActive      - true to activate, false to deactivate
 */
export async function setUserActiveStatus(
  targetUserId: string,
  isActive: boolean
): Promise<StatusChangeResult> {
  // ── 1 & 2: Authenticate requester ────────────────────────────────────────
  let requester;
  try {
    requester = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === "inactive_account") return { success: false, error: "inactive_account" };
      return { success: false, error: "unauthenticated" };
    }
    return { success: false, error: "unauthenticated" };
  }

  // ── 3: Requester must be owner ────────────────────────────────────────────
  if (!isAdminOrOwner(requester.role)) {
    return { success: false, error: "forbidden" };
  }

  // ── 4: Self-modification check ────────────────────────────────────────────
  if (targetUserId === requester.id) {
    return { success: false, error: "self_modification" };
  }

  try {
    const supabase = createAdminClient();

    // ── 5: Fetch target profile ────────────────────────────────────────────
    const { data: target, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (fetchError || !target) {
      return { success: false, error: "target_not_found" };
    }

    // ── 6: Target must not be the owner ───────────────────────────────────
    if (!isValidRole(target.role)) {
      return { success: false, error: "database_error" };
    }
    if (target.role === USER_ROLES.OWNER) {
      return { success: false, error: "target_is_owner" };
    }

    // ── 7: Persist status change ───────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", targetUserId);

    if (updateError) {
      return { success: false, error: "database_error" };
    }

    return {
      success: true,
      userId: targetUserId,
      is_active: isActive,
    };
  } catch {
    return { success: false, error: "database_error" };
  }
}

// ---------------------------------------------------------------------------
// Read operations (owner-only list)
// ---------------------------------------------------------------------------

/**
 * Fetches all user profiles for the owner's team management view.
 * Returns null when the requester is not authenticated or not the owner.
 */
export async function listAllUsers(): Promise<Profile[] | null> {
  let requester;
  try {
    requester = await requireAuth();
  } catch {
    return null;
  }

  if (!isAdminOrOwner(requester.role)) return null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !data) return null;
    return data as Profile[];
  } catch {
    return null;
  }
}
