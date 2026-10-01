import type { AccessibleOrganization, AccessibleSpace } from "@/src/types/space";

/**
 * Resource scope used by video/library and analytics services.
 *
 * Scopes directly to sovereign Organization and optional child Space.
 */
export type OrganizationDataScope = {
  type: "organization";
  organizationId: string;
};

export type SpaceDataScope = {
  type: "space";
  organizationId: string;
  spaceId: string;
};

export type VideoDataScope = OrganizationDataScope | SpaceDataScope;
export type AnalyticsDataScope = VideoDataScope;

export function organizationDataScope(
  organization: Pick<AccessibleOrganization, "id">,
): OrganizationDataScope {
  return { type: "organization", organizationId: organization.id };
}

export function spaceDataScope(
  space: Pick<AccessibleSpace, "organization_id" | "id">,
): SpaceDataScope {
  return { type: "space", organizationId: space.organization_id, spaceId: space.id };
}
