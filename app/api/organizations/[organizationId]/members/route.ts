import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { addOrganizationMember, listOrganizationMembers } from "@/src/lib/organizations/service";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = withAuth(async (_request: NextRequest, user, context) => {
  const { organizationId } = await (context as RouteContext).params;
  if (!organizationId) return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
  const members = await listOrganizationMembers(organizationId, user);
  if (!members) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ members });
});

export const POST = withAuth(async (request: NextRequest, user, context) => {
  const { organizationId } = await (context as RouteContext).params;
  if (!organizationId) return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const profileId = typeof input.profile_id === "string" ? input.profile_id : "";
  const role = typeof input.role === "string" ? input.role : "member";
  const result = await addOrganizationMember(organizationId, user, profileId, role);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: result.error === "forbidden" ? 403 : result.error === "database_error" ? 500 : 400 });
  return NextResponse.json(result, { status: 201 });
});
