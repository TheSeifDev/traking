/**
 * /api/videos
 *
 * GET  – List videos for the authenticated user's workspace
 * POST – Create a new video (admin + owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { listVideos, createVideo } from "@/src/lib/videos/service";
import { isValidSourceType } from "@/src/types/video";

// GET /api/videos — requires videos.read
export const GET = withPermission(
  PERMISSIONS.VIDEOS_READ,
  async (_request: NextRequest, user) => {
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "no_workspace", videos: [] }, { status: 200 });
  }

  const videos = await listVideos(workspaceId);
    return NextResponse.json({ videos });
  },
);

// POST /api/videos — requires videos.create (admin + owner only)
export const POST = withPermission(
  PERMISSIONS.VIDEOS_CREATE,
  async (request: NextRequest, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const title = typeof b.title === "string" ? b.title.trim() : "";
    const source_type = b.source_type;
    const source_url = typeof b.source_url === "string" ? b.source_url.trim() : "";
    const description = typeof b.description === "string" ? b.description.trim() : null;
    const duration = typeof b.duration === "number" ? b.duration : null;

    if (!title || title.length > 255) {
      return NextResponse.json({ error: "invalid_title" }, { status: 400 });
    }
    if (!isValidSourceType(source_type)) {
      return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
    }
    if (!source_url) {
      return NextResponse.json({ error: "invalid_source_url" }, { status: 400 });
    }

    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "no_workspace" }, { status: 422 });
    }

    const video = await createVideo(workspaceId, user.id, {
      title,
      description,
      source_type,
      source_url,
      duration,
    });

    if (!video) {
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    return NextResponse.json({ video }, { status: 201 });
  }
);
