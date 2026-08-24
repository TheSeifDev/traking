/**
 * Dashboard route-group layout
 * DB-validated auth gate + dashboard shell wrapper.
 */
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import DashboardShell from "@/src/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await guardAuth();
  const [workspace, activeSpace] = await Promise.all([
    getPrimaryWorkspace(user.id),
    resolveActiveSpaceForUser(user),
  ]);

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role }}
      workspace={workspace}
      spaces={activeSpace.spaces}
      organizations={activeSpace.organizations}
      activeSpaceId={activeSpace.space?.id ?? null}
      activeOrganizationId={activeSpace.organization?.id ?? null}
      activeSpaceNeedsPersistence={activeSpace.activeSpaceNeedsPersistence}
      activeSpacePreferenceInvalid={activeSpace.activeSpacePreferenceInvalid}
      activeSpaceContext={activeSpace.context}
    >
      {children}
    </DashboardShell>
  );
}