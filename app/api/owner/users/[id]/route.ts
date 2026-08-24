import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { USER_ROLES } from "@/src/types/auth";
import { getUser360 } from "@/src/lib/users/service";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRole(USER_ROLES.OWNER,async (_request: NextRequest, user, context) => {
  const { id } = await (context as RouteContext).params;
  if (!id) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  try {
    const result = await getUser360(id, { kind: "owner" }, user);
    if (!result) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});
