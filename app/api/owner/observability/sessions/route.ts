import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { USER_ROLES } from "@/src/types/auth";
import { getAccessibleOrganizations } from "@/src/lib/spaces/access";
import { listOwnerSessions } from "@/src/lib/observability/service";

export const GET = withRole(USER_ROLES.OWNER, async (request: NextRequest, user) => {
  const organizationId = request.nextUrl.searchParams.get("organization_id")
    || (await getAccessibleOrganizations(user))[0]?.id;
  if (!organizationId) return NextResponse.json({ error: "no_organization" }, { status: 404 });

  const params = request.nextUrl.searchParams;
  try {
    const result = await listOwnerSessions(organizationId, {
      videoId: params.get("video_id") ?? undefined,
      viewerId: params.get("viewer_id") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      limit: Number(params.get("limit")),
      offset: Number(params.get("offset")),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "sessions_unavailable" }, { status: 503 });
  }
});
