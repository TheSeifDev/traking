/**
 * /api/owner/admins – compatibility adapter for owner-only role changes.
 *
 * POST promotes a target profile to admin; DELETE demotes it to viewer.
 * The authoritative authorization and persistence logic lives in
 * changeUserRole().
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { changeUserRole } from "@/src/lib/auth/role-management";
import { PERMISSIONS } from "@/src/types/permissions";
import { USER_ROLES } from "@/src/types/auth";

function errorResponse(error: string): NextResponse {
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
  return NextResponse.json({ error }, { status: statusMap[error] ?? 500 });
}

async function readTargetUserId(request: NextRequest): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>).user_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const POST = withPermission(
  PERMISSIONS.ADMINS_MANAGE,
  async (request: NextRequest) => {
    const targetUserId = await readTargetUserId(request);
    if (!targetUserId) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const result = await changeUserRole(targetUserId, USER_ROLES.ADMIN);
    if (!result.success) return errorResponse(result.error);
    return NextResponse.json({ ...result, promoted: true });
  },
);

export const DELETE = withPermission(
  PERMISSIONS.ADMINS_MANAGE,
  async (request: NextRequest) => {
    const targetUserId = await readTargetUserId(request);
    if (!targetUserId) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const result = await changeUserRole(targetUserId, USER_ROLES.VIEWER);
    if (!result.success) return errorResponse(result.error);
    return NextResponse.json({ ...result, demoted: true });
  },
);
