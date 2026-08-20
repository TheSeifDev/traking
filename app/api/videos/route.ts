/**
 * /api/videos – protected video operations
 *
 * GET    videos.read       – authenticated users (viewer, admin, owner)
 * POST   videos.create     – admin + owner only
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";

// GET /api/videos — requires videos.read
export const GET = withPermission(
  PERMISSIONS.VIDEOS_READ,
  async () => {
    // TODO: implement video listing
    return NextResponse.json({ videos: [] });
  }
);

// POST /api/videos — requires videos.create (admin + owner only)
export const POST = withPermission(
  PERMISSIONS.VIDEOS_CREATE,
  async (request: NextRequest) => {
    // TODO: implement video creation
    void request;
    return NextResponse.json({ created: true }, { status: 201 });
  }
);
