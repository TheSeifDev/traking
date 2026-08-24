/**
 * /api/videos/[id]/watch-link
 * POST - Generate a watch link for a video in the selected Space
 * DELETE - Revoke a watch link for a video in the selected Space
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { resolveSpaceAdminForUser } from "@/src/lib/spaces/access";
import { generateWatchLink, revokeWatchLink } from "@/src/lib/videos/service";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const link = await generateWatchLink(id, access.space.clickup_workspace_id, user.id, access.space.id);
    if (!link) return NextResponse.json({ error: "generation_failed" }, { status: 500 });
    return NextResponse.json({ watch_link: link, space: { id: access.space.id, name: access.space.name } }, { status: link.reused ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});

export const DELETE = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const linkId = (body as Record<string, unknown>).link_id;
  if (typeof linkId !== "string" || !linkId.trim()) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const access = await resolveSpaceAdminForUser(request, user);
    if (!access.space.clickup_workspace_id) return NextResponse.json({ error: "space_not_connected" }, { status: 422 });
    const revoked = await revokeWatchLink(linkId.trim(), id, access.space.clickup_workspace_id, access.space.id);
    if (!revoked) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ revoked: true });
  } catch {
    return NextResponse.json({ error: "forbidden_or_space_required" }, { status: 403 });
  }
});
