import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { getOrganizationForUser, listOrganizationSpaces } from "@/src/lib/organizations/service";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = withAuth(async (_request: NextRequest, user, context) => {
  const { organizationId } = await (context as RouteContext).params;
  if (!organizationId) return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
  try {
    const access = await getOrganizationForUser(organizationId, user);
    const spaces = await listOrganizationSpaces(organizationId, user);
    if (!spaces) return NextResponse.json({ error: "database_error" }, { status: 500 });
    return NextResponse.json({
      organization: access.organization,
      membership: access.membership,
      role: access.effective_role,
      is_platform_owner: access.is_platform_owner,
      spaces,
    });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});
