/**
 * /api/admin/users
 *
 * GET  - List all user profiles (admin + owner)
 * POST - Role management is done via /api/owner/admins — not here.
 *        This endpoint returns 501 until user invite/creation is implemented.
 */
import { NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { listAllUsers } from "@/src/lib/auth/role-management";

export const GET = withPermission(
  PERMISSIONS.USERS_READ,
  async () => {
    const users = await listAllUsers();
    if (!users) return NextResponse.json({ error: "forbidden_or_error" }, { status: 403 });
    return NextResponse.json({ users });
  }
);

export const POST = withPermission(
  PERMISSIONS.USERS_MANAGE,
  async () => {
    return NextResponse.json({ error: "not_implemented" }, { status: 501 });
  }
);