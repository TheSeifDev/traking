import { NextRequest, NextResponse } from "next/server";
import { withDashboardAuth } from "@/src/lib/auth/api-handler";
import { authorizeAllSpacesForUser, clearActiveSpacePreference, setActiveSpacePreference, setAllSpacesPreference } from "@/src/lib/spaces/active-space";
import { getSpaceForUser } from "@/src/lib/spaces/service";
import { isSelectableChildSpace } from "@/src/lib/spaces/labels";

export const POST = withDashboardAuth(async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const payload = body as Record<string, unknown>;
  const scope = typeof payload.scope === "string" ? payload.scope.trim() : "specific";

  if (scope === "all") {
    const organizationId = typeof payload.organization_id === "string" ? payload.organization_id.trim() : "";
    if (!organizationId) return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
    try {
      await authorizeAllSpacesForUser(organizationId, user);
      await setAllSpacesPreference(organizationId);
      return NextResponse.json({ active_space_scope: "all", organization_id: organizationId });
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  if (scope !== "specific") return NextResponse.json({ error: "invalid_scope" }, { status: 400 });

  const rawSpaceId = payload.space_id;
  const spaceId = typeof rawSpaceId === "string" ? rawSpaceId.trim() : "";
  if (!spaceId) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  try {
    const access = await getSpaceForUser(spaceId, user);
    if (!access.organization || !isSelectableChildSpace(access.space, access.organization.name)) {
      return NextResponse.json({ error: "space_not_selectable" }, { status: 409 });
    }
    await setActiveSpacePreference(access.space.id);
    return NextResponse.json({ active_space_scope: "specific", active_space_id: access.space.id });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});

export const DELETE = withDashboardAuth(async () => {
  await clearActiveSpacePreference();
  return NextResponse.json({ cleared: true });
});
