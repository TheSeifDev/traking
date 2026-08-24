import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { removeSpaceMember, updateSpaceMemberRole } from "@/src/lib/spaces/service";
import { getUser360 } from "@/src/lib/users/service";

type RouteContext = { params: Promise<{ spaceId: string; profileId: string }> };

export const GET = withAuth(async (_request: NextRequest, user, context) => {
  const { spaceId, profileId } = await (context as RouteContext).params;
  if (!spaceId || !profileId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  try {
    const data = await getUser360(profileId, { kind: "space", id: spaceId }, user);
    if (!data) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});

function statusFor(error: string): number {
  if (error === "forbidden" || error === "cannot_modify_owner" || error === "cannot_modify_self") return 403;
  if (error === "member_not_found") return 404;
  if (error === "last_admin_required") return 409;
  if (error === "database_error") return 500;
  return 400;
}

export const PATCH = withAuth(async (request: NextRequest, user, context) => {
  const { spaceId, profileId } = await (context as RouteContext).params;
  if (!spaceId || !profileId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const role = (body as Record<string, unknown>).role;
  const result = await updateSpaceMemberRole(spaceId, user, profileId, role);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json(result);
});

export const DELETE = withAuth(async (_request: NextRequest, user, context) => {
  const { spaceId, profileId } = await (context as RouteContext).params;
  if (!spaceId || !profileId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const result = await removeSpaceMember(spaceId, user, profileId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json(result);
});
