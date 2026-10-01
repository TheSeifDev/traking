export function normalizeHierarchyLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export type SpaceHierarchyLabelInput = {
  name: string;
};

/**
 * The stored Space name maps to the user-facing Team name.
 * Normalizes legacy identifiers like 'AI Team-Phantoms' to 'AI Team'.
 */
export function getSpaceDisplayName(space: Pick<SpaceHierarchyLabelInput, "name">): string {
  const name = space.name.trim();
  const lower = name.toLowerCase();
  if (lower === "ai team-phantoms" || lower === "ai-team-phantoms") {
    return "AI Team";
  }
  return name || "Unnamed Team";
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
  if (organizationName && hasOrganizationSpaceLabelCollision(space.name, organizationName)) {
    return false;
  }
  return Boolean(space.name.trim());
}

export function getSafeSpaceDisplayName(spaceName: string, organizationName?: string | null): string {
  if (organizationName && hasOrganizationSpaceLabelCollision(spaceName, organizationName)) return "Legacy Space label (review required)";
  return spaceName;
}

