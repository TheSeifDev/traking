/**
 * /api/videos/[id] – single video operations
 *
 * PUT    videos.update  – admin + owner
 * DELETE videos.delete  – admin + owner
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";

// PUT /api/videos/[id] — requires videos.update
export const PUT = withPermission(
  PERMISSIONS.VIDEOS_UPDATE,
  async (request: NextRequest) => {
    void request;
    // TODO: implement video update
    return NextResponse.json({ updated: true });
  }
);

// DELETE /api/videos/[id] — requires videos.delete
export const DELETE = withPermission(
  PERMISSIONS.VIDEOS_DELETE,
  async (request: NextRequest) => {
    void request;
    // TODO: implement video deletion
    return NextResponse.json({ deleted: true });
  }
);
