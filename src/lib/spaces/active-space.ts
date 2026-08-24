import { cookies } from "next/headers";
import { getAccessibleOrganizations, getAccessibleSpaces, authorizeOrganizationMember, authorizeSpaceMember } from "@/src/lib/spaces/access";
import { isSelectableChildSpace } from "@/src/lib/spaces/labels";
import { isOwner } from "@/src/lib/auth/rbac";
import { SESSION_MAX_AGE_SECONDS } from "@/src/lib/auth/session-cookie";
import type { AuthenticatedUser } from "@/src/types/auth";
import type { AccessibleOrganization, AccessibleSpace, SpaceAccess } from "@/src/types/space";

export const ACTIVE_SPACE_COOKIE = "trackup_active_space";
const ALL_SPACES_PREFIX = "all:";

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

export type ActiveSpacePreference =
  | { type: "all"; organizationId: string }
  | { type: "specific"; spaceId: string }
  | null;

export type ActiveSpaceContext =
  | { type: "all"; organizationId: string }
  | { type: "specific"; spaceId: string; organizationId: string }
  | { type: "none"; organizationId: string | null };

export async function readActiveSpacePreference(): Promise<ActiveSpacePreference> {
  const raw = (await cookies()).get(ACTIVE_SPACE_COOKIE)?.value?.trim() || null;
  if (!raw) return null;
  if (raw.startsWith(ALL_SPACES_PREFIX)) {
    const organizationId = raw.slice(ALL_SPACES_PREFIX.length);
    return isUuid(organizationId) ? { type: "all", organizationId } : null;
  }
  return isUuid(raw) ? { type: "specific", spaceId: raw } : null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function setActiveSpacePreference(spaceId: string): Promise<void> {
  if (!isUuid(spaceId)) throw new Error("Invalid Space ID");
  (await cookies()).set(ACTIVE_SPACE_COOKIE, spaceId, cookieOptions());
}

export async function setAllSpacesPreference(organizationId: string): Promise<void> {
  if (!isUuid(organizationId)) throw new Error("Invalid Organization ID");
  (await cookies()).set(ACTIVE_SPACE_COOKIE, `${ALL_SPACES_PREFIX}${organizationId}`, cookieOptions());
}

export async function clearActiveSpacePreference(): Promise<void> {
  (await cookies()).set(ACTIVE_SPACE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export type ActiveSpaceResolution = {
  organizations: AccessibleOrganization[];
  spaces: AccessibleSpace[];
  organization: AccessibleOrganization | null;
  context: ActiveSpaceContext;
  space: AccessibleSpace | null;
  access: SpaceAccess | null;
  persistedPreference: ActiveSpacePreference;
  persistedSpaceId: string | null;
  activeSpaceNeedsPersistence: boolean;
  activeSpacePreferenceInvalid: boolean;
  requestedSpaceInvalid: boolean;
  requestedOrganizationInvalid: boolean;
  requiresSelection: boolean;
};

function selectableSpaces(spaces: AccessibleSpace[], organizations: AccessibleOrganization[]): AccessibleSpace[] {
  const organizationNames = new Map(organizations.map((organization) => [organization.id, organization.name]));
  return spaces.filter((space) => isSelectableChildSpace(space, organizationNames.get(space.organization_id)));
}

export async function resolveActiveSpaceForUser(
  user: AuthenticatedUser,
  options: { requestedSpaceId?: string | null; requestedOrganizationId?: string | null } = {},
): Promise<ActiveSpaceResolution> {
  const [organizations, loadedSpaces, persistedPreference] = await Promise.all([
    getAccessibleOrganizations(user),
    getAccessibleSpaces(user),
    readActiveSpacePreference(),
  ]);
  const spaces = selectableSpaces(loadedSpaces, organizations);
  const requestedOrganizationId = options.requestedOrganizationId?.trim() || null;
  const requestedOrganization = requestedOrganizationId
    ? organizations.find((organization) => organization.id === requestedOrganizationId) ?? null
    : null;
  const requestedOrganizationInvalid = Boolean(requestedOrganizationId && !requestedOrganization);
  const persistedSpace = persistedPreference?.type === "specific"
    ? spaces.find((space) => space.id === persistedPreference.spaceId) ?? null
    : null;
  const persistedOrganizationId = persistedPreference?.type === "all"
    ? persistedPreference.organizationId
    : persistedSpace?.organization_id ?? null;
  const preferredOrganization = persistedOrganizationId
    ? organizations.find((organization) => organization.id === persistedOrganizationId) ?? null
    : null;
  const organization = requestedOrganization ?? preferredOrganization ?? organizations[0] ?? null;
  const organizationSpaces = organization
    ? spaces.filter((space) => space.organization_id === organization.id)
    : [];
  const requestedSpaceId = options.requestedSpaceId?.trim() || null;
  const requestedSpace = requestedSpaceId
    ? organizationSpaces.find((space) => space.id === requestedSpaceId) ?? null
    : null;
  const requestedSpaceInvalid = Boolean(requestedSpaceId && !requestedSpace);
  const persistedSpaceInOrganization = persistedSpace && organization?.id === persistedSpace.organization_id
    ? persistedSpace
    : null;

  let context: ActiveSpaceContext;
  let selectedSpace: AccessibleSpace | null = null;
  if (isOwner(user.role)) {
    selectedSpace = requestedSpace ?? persistedSpaceInOrganization;
    context = selectedSpace
      ? { type: "specific", spaceId: selectedSpace.id, organizationId: selectedSpace.organization_id }
      : organization
        ? { type: "all", organizationId: organization.id }
        : { type: "none", organizationId: null };
  } else {
    selectedSpace = requestedSpace ?? persistedSpaceInOrganization ?? (organizationSpaces.length === 1 ? organizationSpaces[0] : null);
    context = selectedSpace
      ? { type: "specific", spaceId: selectedSpace.id, organizationId: selectedSpace.organization_id }
      : { type: "none", organizationId: organization?.id ?? null };
  }

  const space = context.type === "specific" ? selectedSpace : null;
  const access = space ? await authorizeSpaceMember(space.id, user) : null;
  const preferenceMatches = context.type === "all"
    ? persistedPreference?.type === "all" && persistedPreference.organizationId === context.organizationId
    : context.type === "specific"
      ? persistedPreference?.type === "specific" && persistedPreference.spaceId === context.spaceId
      : persistedPreference === null;
  const activeSpacePreferenceInvalid = Boolean(
    persistedPreference
      && ((persistedPreference.type === "specific" && !persistedSpaceInOrganization)
        || (persistedPreference.type === "all" && !organizations.some((item) => item.id === persistedPreference.organizationId))),
  );

  return {
    organizations,
    spaces,
    organization,
    context,
    space,
    access,
    persistedPreference,
    persistedSpaceId: persistedPreference?.type === "specific" ? persistedPreference.spaceId : null,
    activeSpaceNeedsPersistence: !preferenceMatches,
    activeSpacePreferenceInvalid,
    requestedSpaceInvalid,
    requestedOrganizationInvalid,
    requiresSelection: context.type === "none" && organizationSpaces.length > 1,
  };
}

export function activeSpaceContext(resolution: ActiveSpaceResolution): ActiveSpaceContext {
  return resolution.context;
}

export async function authorizeAllSpacesForUser(organizationId: string, user: AuthenticatedUser): Promise<AccessibleOrganization> {
  const access = await authorizeOrganizationMember(organizationId, user);
  if (!access.is_platform_owner) throw new Error("All Spaces is owner-only");
  return {
    ...access.organization,
    membership_role: null,
    membership_status: null,
    is_platform_owner: true,
  };
}
