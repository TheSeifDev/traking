/**
 * PATCH /api/owner/users/[id]/role
 *
 * Owner-only endpoint: change the role of a user.
 *
 * Request body:
 *   { "role": "admin" | "viewer" }
 *
 * Any other role value — including "owner" — is rejected with 400.
 *
 * Authorization is enforced server-side inside changeUserRole().
 * This route adds no extra logic; it is a thin HTTP adapter over the
 * centralized role-management module.
 *
 * Responses:
 *   200 { success: true, userId, previousRole, newRole }
 *   400 { error: "invalid_role" | "no_change" | "missing_body" }
 *   401 { error: "unauthenticated" }
 *   403 { error: "forbidden" | "self_modification" | "target_is_owner" | "inactive_account" }
 *   404 { error: "target_not_found" }
 *   500 { error: "database_error" }
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { changeUserRole } from "@/src/lib/auth/role-management";
import { USER_ROLES } from "@/src/types/auth";

export const PATCH = withRole(
  USER_ROLES.OWNER,
  async (request: NextRequest, _user, context) => {
    // Extract [id] from route context
    const routeContext = context as { params: Promise<{ id: string }> | { id: string } };
    const params = await routeContext.params;
    const targetUserId: string = params.id;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "missing_body" }, { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("role" in body)
    ) {
      return NextResponse.json({ error: "missing_body" }, { status: 400 });
    }

    const requestedRole = (body as Record<string, unknown>).role;

    // Delegate to the authoritative logic module
    const result = await changeUserRole(targetUserId, requestedRole);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        unauthenticated: 401,
        inactive_account: 403,
        forbidden: 403,
        self_modification: 403,
        target_is_owner: 403,
        invalid_role: 400,
        no_change: 400,
        target_not_found: 404,
        database_error: 500,
      };
      return NextResponse.json(
        { error: result.error },
        { status: statusMap[result.error] ?? 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  }
);
