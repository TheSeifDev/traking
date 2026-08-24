import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { searchOrganizationMemberCandidates } from "@/src/lib/organizations/service";

type RouteContext = { params: Promise<{ organizationId: string }> };

export const GET = withDashboardAuth(async (request: NextRequest, user, context) => {
  const { organizationId } = await (context as RouteContext).params;
  if (!organizationId) return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const candidates = await searchOrganizationMemberCandidates(organizationId, user, query);
  if (!candidates) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ candidates });
});
