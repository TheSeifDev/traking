/**
 * /api/videos/[id]
 *
 * GET    - Get single video
 * PUT    - Update video (admin + owner only)
 * DELETE - Delete video (admin + owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getVideo, updateVideo, deleteVideo } from "@/src/lib/videos/service";
import { isValidSourceType } from "@/src/types/video";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission(
  PERMISSIONS.VIDEOS_READ,
  async (_request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });
  const video = await getVideo(id, workspaceId);
  if (!video) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ video });
  },
);

export const PUT = withPermission(
  PERMISSIONS.VIDEOS_UPDATE,
  async (request: NextRequest, user, context) => {
    const { id } = await (context as RouteContext).params;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    const b = body as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};
    if (typeof b.title === "string") {
      const t = b.title.trim();
      if (!t || t.length > 255) return NextResponse.json({ error: "invalid_title" }, { status: 400 });
      updateData.title = t;
    }
    if (b.description !== undefined) updateData.description = typeof b.description === "string" ? b.description.trim() : null;
    if (b.source_type !== undefined) {
      if (!isValidSourceType(b.source_type)) return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
      updateData.source_type = b.source_type;
    }
    if (typeof b.source_url === "string") { const u = b.source_url.trim(); if (!u) return NextResponse.json({ error: "invalid_source_url" }, { status: 400 }); updateData.source_url = u; }
    if (typeof b.duration === "number") updateData.duration = b.duration;
    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });
    const video = await updateVideo(id, workspaceId, updateData as Parameters<typeof updateVideo>[2]);
    if (!video) return NextResponse.json({ error: "not_found_or_update_failed" }, { status: 404 });
    return NextResponse.json({ video });
  }
);

export const DELETE = withPermission(
  PERMISSIONS.VIDEOS_DELETE,
  async (_request: NextRequest, user, context) => {
    const { id } = await (context as RouteContext).params;
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 404 });
    const deleted = await deleteVideo(id, workspaceId);
    if (!deleted) return NextResponse.json({ error: "not_found_or_delete_failed" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  }
);