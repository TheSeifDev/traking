import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { createSpace } from "@/src/lib/spaces/service";
import { listOrganizationSpaces } from "@/src/lib/organizations/service";

type RouteContext = { params: Promise<{ organizationId: string }> };

function statusFor(error: string): number {
  if (error === "forbidden") return 403;
  if (error === "slug_taken" || error === "organization_mismatch") return 409;
  if (error === "clickup_workspace_not_found") return 404;
  if (error === "database_error") return 500;
  return 400;
}

export const GET = withDashboardAuth(async (_request: NextRequest, user, context) => {
  const { organizationId } = await (context as RouteContext).params;
  if (!organizationId) return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
  const spaces = await listOrganizationSpaces(organizationId, user);
  if (!spaces) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ spaces });
});

export const POST = withDashboardAuth(async (request: NextRequest, user, context) => {
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
  const name = typeof input.name === "string" ? input.name : "";
  const slug = typeof input.slug === "string" ? input.slug : null;
  const clickupWorkspaceId = typeof input.clickup_workspace_id === "string" ? input.clickup_workspace_id : null;
  const result = await createSpace(user, { name, slug, organizationId, clickupWorkspaceId });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json(result, { status: 201 });
});
