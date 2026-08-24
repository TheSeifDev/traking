export function normalizeHierarchyLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function getSafeSpaceDisplayName(spaceName: string, organizationName: string | null | undefined): string {
  if (organizationName && normalizeHierarchyLabel(spaceName) === normalizeHierarchyLabel(organizationName)) return "Legacy Space label (review required)";
  return spaceName;
}

export function hasOrganizationSpaceLabelCollision(spaceName: string, organizationName: string | null | undefined): boolean {
  return Boolean(organizationName && normalizeHierarchyLabel(spaceName) === normalizeHierarchyLabel(organizationName));
}
