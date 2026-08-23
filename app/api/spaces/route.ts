import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/src/lib/auth/api-handler";
import { createSpace, listSpacesForUser } from "@/src/lib/spaces/service";
import { USER_ROLES } from "@/src/types/auth";

function statusFor(error: string): number {
  if (error === "forbidden") return 403;
  if (error === "slug_taken") return 409;
  if (error === "clickup_workspace_not_found") return 404;
  if (error === "database_error") return 500;
  return 400;
}

export const GET = withAuth(async (_request, user) => {
  const spaces = await listSpacesForUser(user);
  return NextResponse.json({ spaces });
});

export const POST = withRole(USER_ROLES.OWNER, async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name : "";
  const slug = typeof input.slug === "string" ? input.slug : null;
  const clickupWorkspaceId = typeof input.clickup_workspace_id === "string" ? input.clickup_workspace_id : null;
  const result = await createSpace(user, { name, slug, clickupWorkspaceId });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json(result, { status: 201 });
});
