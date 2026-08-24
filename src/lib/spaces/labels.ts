export function normalizeHierarchyLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export type SpaceHierarchyLabelInput = {
  name: string;
  clickup_space_id?: string | null;
  clickup_workspace_id?: string | null;
};

/**
 * The stored Space name is the user-facing name. ClickUp sync persists the
 * canonical child-Space name into this field; it must never be replaced by a
 * diagnostic label when a provider name is unavailable.
 */
export function getSpaceDisplayName(space: Pick<SpaceHierarchyLabelInput, "name">): string {
  const name = space.name.trim();
  return name || "Unnamed Space";
}

export function hasOrganizationSpaceLabelCollision(spaceName: string, organizationName: string | null | undefined): boolean {
  return Boolean(organizationName && normalizeHierarchyLabel(spaceName) === normalizeHierarchyLabel(organizationName));
}

/**
 * Legacy rows created before Organization/Space mapping can carry the
 * Workspace relationship and the Organization name. They remain in storage
 * for historical data, but are not a selectable child Space until a real
 * ClickUp Space ID is bound.
 */
export function isLegacyOrganizationContainerSpace(
  space: SpaceHierarchyLabelInput,
  organizationName: string | null | undefined,
): boolean {
  return !space.clickup_space_id
    && Boolean(space.clickup_workspace_id)
    && hasOrganizationSpaceLabelCollision(space.name, organizationName);
}

/**
 * A linked ClickUp Space is a real child even if its name happens to match the
 * Organization. An unlinked Organization-label row is not shown as a normal
 * Space option.
 */
export function isSelectableChildSpace(
  space: SpaceHierarchyLabelInput,
  organizationName: string | null | undefined,
): boolean {
  return !isLegacyOrganizationContainerSpace(space, organizationName);
}

/**
 * Compatibility helper for owner/diagnostic views. Normal navigation and
 * Space cards use getSpaceDisplayName directly and never call this fallback.
 */
export function getSafeSpaceDisplayName(spaceName: string, organizationName?: string | null): string {
  if (organizationName && hasOrganizationSpaceLabelCollision(spaceName, organizationName)) return "Legacy Space label (review required)";
  return getSpaceDisplayName({ name: spaceName });
}
