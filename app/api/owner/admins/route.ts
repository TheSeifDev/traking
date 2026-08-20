/**
 * /api/owner/admins – admin promotion/demotion (owner only)
 *
 * POST   admins.manage  – owner only
 * DELETE admins.manage  – owner only
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";

export const POST = withPermission(
  PERMISSIONS.ADMINS_MANAGE,
  async (request: NextRequest) => {
    void request;
    // TODO: implement admin promotion
    return NextResponse.json({ promoted: true }, { status: 201 });
  }
);

export const DELETE = withPermission(
  PERMISSIONS.ADMINS_MANAGE,
  async (request: NextRequest) => {
    void request;
    // TODO: implement admin demotion
    return NextResponse.json({ demoted: true });
  }
);
