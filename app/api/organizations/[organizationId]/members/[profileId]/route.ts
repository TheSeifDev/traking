import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { getUser360 } from "@/src/lib/users/service";
import { removeOrganizationMember, updateOrganizationMemberRole } from "@/src/lib/organizations/service";

type RouteContext = { params: Promise<{ organizationId: string; profileId: string }> };

function statusFor(error: string): number {
  if (error === "forbidden" || error === "cannot_modify_owner") return 403;
  if (error === "member_not_found") return 404;
  if (error === "database_error") return 500;
  return 400;
}

export const GET = withDashboardAuth(async (_request: NextRequest, user, context) => {
  const { organizationId, profileId } = await (context as RouteContext).params;
  if (!organizationId || !profileId) return NextResponse.json({ error: "missing_member_id" }, { status: 400 });
  try {
    const result = await getUser360(profileId, { kind: "organization", id: organizationId }, user);
    if (!result) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});

export const PATCH = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { organizationId, profileId } = await (context as RouteContext).params;
  if (!organizationId || !profileId) return NextResponse.json({ error: "missing_member_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const role = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).role === "string"
    ? (body as Record<string, unknown>).role
    : null;
  const result = await updateOrganizationMemberRole(organizationId, user, profileId, role);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json(result);
});

export const DELETE = withDashboardAuth(async (_request: NextRequest, user, context) => {
  const { organizationId, profileId } = await (context as RouteContext).params;
  if (!organizationId || !profileId) return NextResponse.json({ error: "missing_member_id" }, { status: 400 });
  const result = await removeOrganizationMember(organizationId, user, profileId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json(result);
});
