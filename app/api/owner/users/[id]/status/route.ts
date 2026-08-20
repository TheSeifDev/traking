/**
 * PATCH /api/owner/users/[id]/status
 *
 * Owner-only endpoint: activate or deactivate a user account.
 * Permanent deletion is NOT supported — use is_active = false instead.
 *
 * Request body:
 *   { "is_active": true | false }
 *
 * Authorization is enforced server-side inside setUserActiveStatus().
 * The owner's own account cannot be deactivated (self_modification guard).
 * The owner account can never be deactivated (target_is_owner guard).
 *
 * Responses:
 *   200 { success: true, userId, is_active }
 *   400 { error: "missing_body" }
 *   401 { error: "unauthenticated" }
 *   403 { error: "forbidden" | "self_modification" | "target_is_owner" | "inactive_account" }
 *   404 { error: "target_not_found" }
 *   500 { error: "database_error" }
 */

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { setUserActiveStatus } from "@/src/lib/auth/role-management";

export const PATCH = withPermission(
  PERMISSIONS.ADMINS_MANAGE,
  async (request: NextRequest, _user, context) => {
    const routeContext = context as { params: Promise<{ id: string }> | { id: string } };
    const params = await routeContext.params;
    const targetUserId: string = params.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "missing_body" }, { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("is_active" in body) ||
      typeof (body as Record<string, unknown>).is_active !== "boolean"
    ) {
      return NextResponse.json({ error: "missing_body" }, { status: 400 });
    }

    const isActive = (body as { is_active: boolean }).is_active;

    const result = await setUserActiveStatus(targetUserId, isActive);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        unauthenticated: 401,
        inactive_account: 403,
        forbidden: 403,
        self_modification: 403,
        target_is_owner: 403,
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
