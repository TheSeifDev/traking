/**
 * /api/videos/[id]
 *
 * Space-aware private video API. The selector is only a lookup hint; every
 * request is authorized against the authenticated user's Space membership.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { resolveSpaceAdminForUser, resolveSpaceForUser } from "@/src/lib/spaces/access";
import { getVideo, updateVideo, deleteVideo } from "@/src/lib/videos/service";
import { isValidSourceType } from "@/src/types/video";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    const access = await resolveSpaceForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const video = await getVideo(id, access.space.clickup_workspace_id, access.space.id);
    if (!video) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ video, space: { id: access.space.id, name: access.space.name } });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});

export const PUT = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const b = body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  if (typeof b.title === "string") {
    const title = b.title.trim();
    if (!title || title.length > 255) return NextResponse.json({ error: "invalid_title" }, { status: 400 });
    updateData.title = title;
  }
  if (b.description !== undefined) updateData.description = typeof b.description === "string" ? b.description.trim() : null;
  if (b.source_type !== undefined) {
    if (!isValidSourceType(b.source_type)) return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
    updateData.source_type = b.source_type;
  }
  if (typeof b.source_url === "string") {
    const sourceUrl = b.source_url.trim();
    if (!sourceUrl) return NextResponse.json({ error: "invalid_source_url" }, { status: 400 });
    updateData.source_url = sourceUrl;
  }
  if (typeof b.duration === "number") updateData.duration = b.duration;

  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const video = await updateVideo(id, access.space.clickup_workspace_id, updateData, access.space.id);
    if (!video) return NextResponse.json({ error: "not_found_or_update_failed" }, { status: 404 });
    return NextResponse.json({ video });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});

export const DELETE = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const deleted = await deleteVideo(id, access.space.clickup_workspace_id, access.space.id);
    if (!deleted) return NextResponse.json({ error: "not_found_or_delete_failed" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});
