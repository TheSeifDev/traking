import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { searchSpaceMemberCandidates } from "@/src/lib/spaces/service";

type RouteContext = { params: Promise<{ spaceId: string }> };

export const GET = withAuth(async (request: NextRequest, user, context) => {
  const { spaceId } = await (context as RouteContext).params;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  const candidates = await searchSpaceMemberCandidates(spaceId, user, query);
  if (candidates === null) return NextResponse.json({ error: "forbidden_or_error" }, { status: 403 });
  return NextResponse.json({ candidates });
});
