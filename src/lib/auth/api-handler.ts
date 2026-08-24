/**
 * TrackUp Protected API Route Handler Wrapper
 *
 * Wraps Next.js Route Handler functions with server-side RBAC enforcement.
 * The handler is only called when authentication and authorization pass.
 * On failure it returns a JSON error response with the appropriate HTTP status.
 *
 * Usage:
 *
 *   // Require authentication only
 *   export const POST = withAuth(async (req, user) => {
 *     return NextResponse.json({ ok: true });
 *   });
 *
 *   // Require a minimum role
 *   export const DELETE = withRole(USER_ROLES.ADMIN, async (req, user) => {
 *     return NextResponse.json({ deleted: true });
 *   });
 *
 *   // Require a specific permission
 *   export const POST = withPermission(PERMISSIONS.VIDEOS_CREATE, async (req, user) => {
 *     return NextResponse.json({ created: true });
 *   });
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireRole, requirePermission, AuthError } from "./session";
import { USER_ROLES, type AuthenticatedUser, type UserRole } from "@/src/types/auth";
import type { Permission } from "@/src/types/permissions";
import { writeOwnerLog } from "@/src/lib/observability/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthenticatedHandler = (
  request: NextRequest,
  user: AuthenticatedUser,
  context?: unknown
) => Promise<NextResponse> | NextResponse;

// ---------------------------------------------------------------------------
// Internal: map AuthError code → HTTP status
// ---------------------------------------------------------------------------

function authErrorToResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    const status =
      err.code === "unauthenticated" || err.code === "missing_profile"
        ? 401
        : err.code === "inactive_account" || err.code === "forbidden"
          ? 403
          : 500;

    void writeOwnerLog({
      level: status >= 500 ? "ERROR" : "WARN",
      category: "AUTH",
      action: `auth_${err.code}`,
      status,
      metadata: { auth_error: err.code },
    });
    return NextResponse.json(
      { error: err.code },
      { status }
    );
  }
  void writeOwnerLog({ level: "ERROR", category: "AUTH", action: "auth_unknown_failure", status: 500 });
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

// ---------------------------------------------------------------------------
// Wrappers
// ---------------------------------------------------------------------------

/**
 * Wraps a Route Handler – requires authentication only.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async function (request: NextRequest, context?: unknown): Promise<NextResponse> {
    try {
      const user = await requireAuth();
      return await handler(request, user, context);
    } catch (err) {
      return authErrorToResponse(err);
    }
  };
}

/**
 * Wraps an internal dashboard API route. Viewer profiles are restricted to the
 * Watch Link/tracking surface; Admin and Owner are the only roles allowed to
 * invoke internal dashboard APIs. Resource services still enforce tenancy.
 */
export function withDashboardAuth(handler: AuthenticatedHandler) {
  return withRole(USER_ROLES.ADMIN, handler);
}

/**
 * Wraps a Route Handler – requires the user to hold at least `minimumRole`.
 */
export function withRole(minimumRole: UserRole, handler: AuthenticatedHandler) {
  return async function (request: NextRequest, context?: unknown): Promise<NextResponse> {
    try {
      const user = await requireRole(minimumRole);
      return await handler(request, user, context);
    } catch (err) {
      return authErrorToResponse(err);
    }
  };
}

/**
 * Wraps a Route Handler – requires the user's role to grant `permission`.
 */
export function withPermission(permission: Permission, handler: AuthenticatedHandler) {
  return async function (request: NextRequest, context?: unknown): Promise<NextResponse> {
    try {
      const user = await requirePermission(permission);
      return await handler(request, user, context);
    } catch (err) {
      return authErrorToResponse(err);
    }
  };
}
