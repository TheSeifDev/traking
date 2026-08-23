import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { addSpaceMember, listSpaceMembers } from "@/src/lib/spaces/service";

type RouteContext = { params: Promise<{ spaceId: string }> };

function statusFor(error: string): number {
  if (error === "forbidden") return 403;
  if (error === "member_not_found") return 404;
  if (error === "membership_exists") return 409;
  if (error === "database_error") return 500;
  return 400;
}

export const GET = withAuth(async (_request: NextRequest, user, context) => {
  const { spaceId } = await (context as RouteContext).params;
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  const members = await listSpaceMembers(spaceId, user);
  if (members === null) return NextResponse.json({ error: "forbidden_or_error" }, { status: 403 });
  return NextResponse.json({ members });
});

export const POST = withAuth(async (request: NextRequest, user, context) => {
  const { spaceId } = await (context as RouteContext).params;
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const profileId = typeof input.profile_id === "string" ? input.profile_id.trim() : "";
  if (!profileId) return NextResponse.json({ error: "missing_profile_id" }, { status: 400 });
  const result = await addSpaceMember(spaceId, user, profileId, input.role);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json(result, { status: 201 });
});
