import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { clearActiveSpacePreference, setActiveSpacePreference } from "@/src/lib/spaces/active-space";
import { getSpaceForUser } from "@/src/lib/spaces/service";
import { isSelectableChildSpace } from "@/src/lib/spaces/labels";

export const POST = withAuth(async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const rawSpaceId = (body as Record<string, unknown>).space_id;
  const spaceId = typeof rawSpaceId === "string" ? rawSpaceId.trim() : "";
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });

  try {
    const access = await getSpaceForUser(spaceId, user);
    if (!access.organization || !isSelectableChildSpace(access.space, access.organization.name)) {
      return NextResponse.json({ error: "space_not_selectable" }, { status: 409 });
    }
    await setActiveSpacePreference(access.space.id);
    return NextResponse.json({ active_space_id: access.space.id });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});

export const DELETE = withAuth(async () => {
  await clearActiveSpacePreference();
  return NextResponse.json({ cleared: true });
});
