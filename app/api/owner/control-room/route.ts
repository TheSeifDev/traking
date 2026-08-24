import { NextResponse, type NextRequest } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { getControlRoomData } from "@/src/lib/observability/control-room";
import { USER_ROLES } from "@/src/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readParam(request: NextRequest, key: string, maxLength = 120): string | null {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  return value ? value.slice(0, maxLength) : null;
}

export const GET = withRole(USER_ROLES.OWNER, async (request) => {
  try {
    const data = await getControlRoomData({
      range: readParam(request, "range", 20),
      query: readParam(request, "q", 120),
      organizationId: readParam(request, "organization_id", 80),
      spaceId: readParam(request, "space_id", 80),
      provider: readParam(request, "provider", 30),
    });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "control_room_unavailable" }, { status: 503 });
  }
});
