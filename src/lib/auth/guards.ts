/**
 * TrackUp Server-Side Page Guards
 *
 * Used at the top of Server Component pages (and layouts) to enforce
 * authentication and role authorization with a real database validation.
 *
 * These are intentionally separate from middleware because:
 *  - Middleware must stay fast (no DB calls on every request).
 *  - Page guards run only when a page is actually rendered, allowing a full
 *    DB check against the live profiles table.
 *
 * Usage inside a Server Component page:
 *
 *   import { guardAuth, guardAdmin, guardOwner } from "@/src/lib/auth/guards";
 *
 *   export default async function DashboardPage() {
 *     await guardAuth();          // throws / redirects if not authenticated
 *     // page content...
 *   }
 */

import { redirect } from "next/navigation";
import { requireAuth, requireRole, requirePermission, AuthError } from "./session";
import type { AuthenticatedUser, UserRole } from "@/src/types/auth";
import { USER_ROLES } from "@/src/types/auth";
import type { Permission } from "@/src/types/permissions";

// ---------------------------------------------------------------------------
// Internal helper – maps AuthError codes to redirect targets
// ---------------------------------------------------------------------------

function handleAuthError(err: unknown, redirectOnForbidden = "/dashboard?error=forbidden"): never {
  if (err instanceof AuthError) {
    switch (err.code) {
      case "unauthenticated":
      case "missing_profile":
        redirect("/login?error=unauthenticated");
        break;
      case "inactive_account":
        redirect("/login?error=account_inactive");
        break;
      case "forbidden":
        redirect(redirectOnForbidden);
        break;
      default:
        redirect("/login?error=server_error");
    }
  }
  // Unexpected error – fail closed
  redirect("/login?error=server_error");
}

// ---------------------------------------------------------------------------
// Public guards
// ---------------------------------------------------------------------------

/**
 * Ensures the current request is authenticated and the account is active.
 * Redirects to /login on any failure.
 * Returns the AuthenticatedUser so the page can use it directly.
 */
export async function guardAuth(): Promise<AuthenticatedUser> {
  try {
    return await requireAuth();
  } catch (err) {
    handleAuthError(err);
  }
}

/**
 * Ensures the user meets the minimum role in the hierarchy.
 * Redirects to /dashboard?error=forbidden when the role is insufficient.
 */
export async function guardRole(
  minimumRole: UserRole,
  forbiddenRedirect = "/dashboard?error=forbidden"
): Promise<AuthenticatedUser> {
  try {
    return await requireRole(minimumRole);
  } catch (err) {
    handleAuthError(err, forbiddenRedirect);
  }
}

/**
 * Ensures the user has a specific permission.
 * Redirects to /dashboard?error=forbidden when the permission is missing.
 */
export async function guardPermission(
  permission: Permission,
  forbiddenRedirect = "/dashboard?error=forbidden"
): Promise<AuthenticatedUser> {
  try {
    return await requirePermission(permission);
  } catch (err) {
    handleAuthError(err, forbiddenRedirect);
  }
}

// ---------------------------------------------------------------------------
// Semantic convenience guards
// ---------------------------------------------------------------------------

/**
 * Requires admin or owner.  Viewer → redirected to /dashboard?error=forbidden.
 */
export async function guardAdmin(): Promise<AuthenticatedUser> {
  return guardRole(USER_ROLES.ADMIN);
}

/**
 * Requires owner only.  Admin/Viewer → redirected to /dashboard?error=forbidden.
 */
export async function guardOwner(): Promise<AuthenticatedUser> {
  return guardRole(USER_ROLES.OWNER);
}
