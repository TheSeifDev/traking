/**
 * /api/admin/users – user management operations
 *
 * GET    users.read    – admin + owner
 * POST   users.manage  – owner only
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";

// GET /api/admin/users — requires users.read (admin + owner)
export const GET = withPermission(
  PERMISSIONS.USERS_READ,
  async () => {
    // TODO: implement user listing
    return NextResponse.json({ users: [] });
  }
);

// POST /api/admin/users — requires users.manage (owner only)
export const POST = withPermission(
  PERMISSIONS.USERS_MANAGE,
  async (request: NextRequest) => {
    void request;
    // TODO: implement user creation / role assignment
    return NextResponse.json({ created: true }, { status: 201 });
  }
);
