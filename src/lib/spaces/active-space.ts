import { cookies } from "next/headers";
import { getAccessibleOrganizations, getAccessibleSpaces, authorizeSpaceMember } from "@/src/lib/spaces/access";
import { isSelectableChildSpace } from "@/src/lib/spaces/labels";
import { SESSION_MAX_AGE_SECONDS } from "@/src/lib/auth/session-cookie";
import type { AuthenticatedUser } from "@/src/types/auth";
import type { AccessibleOrganization, AccessibleSpace, SpaceAccess } from "@/src/types/space";

export const ACTIVE_SPACE_COOKIE = "trackup_active_space";

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

export async function readActiveSpacePreference(): Promise<string | null> {
  const raw = (await cookies()).get(ACTIVE_SPACE_COOKIE)?.value?.trim() || null;
  return isUuid(raw) ? raw : null;
}

export async function setActiveSpacePreference(spaceId: string): Promise<void> {
  if (!isUuid(spaceId)) throw new Error("Invalid Space ID");
  (await cookies()).set(ACTIVE_SPACE_COOKIE, spaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearActiveSpacePreference(): Promise<void> {
  (await cookies()).set(ACTIVE_SPACE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export type ActiveSpaceResolution = {
  organizations: AccessibleOrganization[];
  spaces: AccessibleSpace[];
  organization: AccessibleOrganization | null;
  space: AccessibleSpace | null;
  access: SpaceAccess | null;
  persistedSpaceId: string | null;
  activeSpaceNeedsPersistence: boolean;
  activeSpacePreferenceInvalid: boolean;
  requestedSpaceInvalid: boolean;
  requiresSelection: boolean;
};

function selectableSpaces(spaces: AccessibleSpace[], organizations: AccessibleOrganization[]): AccessibleSpace[] {
  const organizationNames = new Map(organizations.map((organization) => [organization.id, organization.name]));
  return spaces.filter((space) => isSelectableChildSpace(space, organizationNames.get(space.organization_id)));
}

export async function resolveActiveSpaceForUser(
  user: AuthenticatedUser,
  options: { requestedSpaceId?: string | null } = {},
): Promise<ActiveSpaceResolution> {
  const [organizations, loadedSpaces, persistedSpaceId] = await Promise.all([
    getAccessibleOrganizations(user),
    getAccessibleSpaces(user),
    readActiveSpacePreference(),
  ]);
  const spaces = selectableSpaces(loadedSpaces, organizations);
  const requestedSpaceId = options.requestedSpaceId?.trim() || null;
  const requestedSpace = requestedSpaceId ? spaces.find((space) => space.id === requestedSpaceId) ?? null : null;
  const persistedSpace = persistedSpaceId ? spaces.find((space) => space.id === persistedSpaceId) ?? null : null;
  const invalidRequested = Boolean(requestedSpaceId && !requestedSpace);
  const invalidPersisted = Boolean(persistedSpaceId && !persistedSpace);
  const selectedSpace = requestedSpace ?? persistedSpace ?? (spaces.length === 1 ? spaces[0] : null);
  const organization = selectedSpace
    ? organizations.find((item) => item.id === selectedSpace.organization_id) ?? null
    : organizations[0] ?? null;
  const access = selectedSpace ? await authorizeSpaceMember(selectedSpace.id, user) : null;

  return {
    organizations,
    spaces,
    organization,
    space: selectedSpace,
    access,
    persistedSpaceId,
    activeSpaceNeedsPersistence: Boolean(selectedSpace && selectedSpace.id !== persistedSpaceId),
    activeSpacePreferenceInvalid: invalidPersisted,
    requestedSpaceInvalid: invalidRequested,
    requiresSelection: !selectedSpace && spaces.length > 1,
  };
}

export function activeSpaceContext(
  resolution: ActiveSpaceResolution,
): { activeSpaceId: string | null; activeOrganizationId: string | null } {
  return {
    activeSpaceId: resolution.space?.id ?? null,
    activeOrganizationId: resolution.space?.organization_id ?? resolution.organization?.id ?? null,
  };
}

