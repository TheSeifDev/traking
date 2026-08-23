import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { getSpaceForUser } from "@/src/lib/spaces/service";

type RouteContext = { params: Promise<{ spaceId: string }> };

export const GET = withAuth(async (_request: NextRequest, user, context) => {
  const { spaceId } = await (context as RouteContext).params;
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  try {
    const access = await getSpaceForUser(spaceId, user);
    return NextResponse.json({
      space: access.space,
      membership: access.membership,
      is_platform_owner: access.is_platform_owner,
      role: access.effective_role,
    });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});
