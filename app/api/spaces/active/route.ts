import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { clearActiveSpacePreference, setActiveSpacePreference, setAllSpacesPreference } from "@/src/lib/spaces/active-space";
import { authorizeOrganizationMember } from "@/src/lib/spaces/access";
import { getSpaceForUser } from "@/src/lib/spaces/service";
import { isSelectableChildSpace } from "@/src/lib/spaces/labels";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// POST — persist the active-space preference cookie for the calling user.
// Authentication is required; the requested space/organization must be one the
// caller can actually access. This is a per-user UI preference, not a tenant
// mutation, so we deliberately do NOT require the dashboard ADMIN wrapper.
// Each call only ever writes the calling user's cookie, so a viewer cannot
// mutate another user's preference.
export const POST = withAuth(async (request: NextRequest, user) => {
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
    if (!organizationId || !isUuid(organizationId)) return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
    try {
      // Per-user UI preference: any authenticated member of the organization may
      // persist their own "All Spaces" view for that organization. Owner-only
      // tenant mutations remain gated elsewhere.
      await authorizeOrganizationMember(organizationId, user);
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    await setAllSpacesPreference(organizationId);
    return NextResponse.json({ active_space_scope: "all", organization_id: organizationId });
  }
  if (scope !== "specific") return NextResponse.json({ error: "invalid_scope" }, { status: 400 });

  const rawSpaceId = payload.space_id;
  const spaceId = typeof rawSpaceId === "string" ? rawSpaceId.trim() : "";
  if (!spaceId || !isUuid(spaceId)) return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  try {
    // authorizeSpaceMember (via getSpaceForUser) enforces that the caller is a
    // platform owner OR an active organization/space member. Viewers are accepted
    // for the specific spaces they belong to; non-members receive 403.
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

// DELETE — clear the calling user's active-space preference cookie.
// Per-user, no tenant scope needed.
export const DELETE = withAuth(async () => {
  await clearActiveSpacePreference();
  return NextResponse.json({ cleared: true });
});
