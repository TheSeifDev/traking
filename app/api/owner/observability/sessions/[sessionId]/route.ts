import { NextResponse, type NextRequest } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { USER_ROLES } from "@/src/types/auth";
import { getAccessibleOrganizations } from "@/src/lib/spaces/access";
import { getOwnerSession } from "@/src/lib/observability/service";

type RouteContext = { params: Promise<{ sessionId: string }> };

export const GET = withRole(USER_ROLES.OWNER, async (request: NextRequest, user, context) => {
  const { sessionId } = await (context as RouteContext).params;
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  const organizationId = request.nextUrl.searchParams.get("organization_id")
    || (await getAccessibleOrganizations(user))[0]?.id;
  if (!organizationId) return NextResponse.json({ error: "no_organization" }, { status: 404 });

  try {
    const session = await getOwnerSession(organizationId, sessionId);
    if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ error: "session_unavailable" }, { status: 503 });
  }
});
