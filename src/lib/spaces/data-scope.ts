import type { AccessibleOrganization, AccessibleSpace } from "@/src/types/space";

/**
 * Resource scope used by video/library and analytics services.
 *
 * Organization scope is virtual: it is never a database Space and never a
 * synthetic UUID. The workspace foreign key is the persisted organization
 * boundary for legacy and current resources because organizations enforce a
 * unique ClickUp workspace relationship.
 */
export type OrganizationDataScope = {
  type: "organization";
  organizationId: string;
  workspaceId: string;
};

export type SpaceDataScope = {
  type: "space";
  organizationId: string;
  spaceId: string;
  workspaceId: string;
};

/**
 * Platform observability may intentionally inspect a whole ClickUp workspace
 * after its Owner-only authorization has already happened. Product pages
 * must use OrganizationDataScope or SpaceDataScope instead.
 */
export type WorkspaceDataScope = {
  type: "workspace";
  workspaceId: string;
};

export type VideoDataScope = OrganizationDataScope | SpaceDataScope;
export type AnalyticsDataScope = VideoDataScope | WorkspaceDataScope;

export function organizationDataScope(
  organization: Pick<AccessibleOrganization, "id" | "clickup_workspace_id">,
): OrganizationDataScope | null {
  return organization.clickup_workspace_id
    ? { type: "organization", organizationId: organization.id, workspaceId: organization.clickup_workspace_id }
    : null;
}

export function spaceDataScope(
  space: Pick<AccessibleSpace, "organization_id" | "id" | "clickup_workspace_id">,
): SpaceDataScope | null {
  return space.clickup_workspace_id
    ? { type: "space", organizationId: space.organization_id, spaceId: space.id, workspaceId: space.clickup_workspace_id }
    : null;
}

export function workspaceDataScope(workspaceId: string): WorkspaceDataScope {
  return { type: "workspace", workspaceId };
}
