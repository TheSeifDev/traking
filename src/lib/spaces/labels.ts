export function normalizeHierarchyLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export type SpaceHierarchyLabelInput = {
  name: string;
};

/**
 * The stored Space name is the user-facing name.
 */
export function getSpaceDisplayName(space: Pick<SpaceHierarchyLabelInput, "name">): string {
  const name = space.name.trim();
  return name || "Unnamed Space";
}

export function hasOrganizationSpaceLabelCollision(spaceName: string, organizationName: string | null | undefined): boolean {
  return Boolean(organizationName && normalizeHierarchyLabel(spaceName) === normalizeHierarchyLabel(organizationName));
}

export function isLegacyOrganizationContainerSpace(
  space: SpaceHierarchyLabelInput,
  organizationName: string | null | undefined,
): boolean {
  return hasOrganizationSpaceLabelCollision(space.name, organizationName);
}

export function isSelectableChildSpace(
  space: SpaceHierarchyLabelInput,
  organizationName?: string | null,
): boolean {
  void organizationName;
  return Boolean(space.name.trim());
}

export function getSafeSpaceDisplayName(spaceName: string, organizationName?: string | null): string {
  if (hasOrganizationSpaceLabelCollision(spaceName, organizationName)) {
    return "Legacy Space label (review required)";
  }
  return getSpaceDisplayName({ name: spaceName });
}
