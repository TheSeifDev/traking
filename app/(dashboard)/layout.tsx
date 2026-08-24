/**
 * Dashboard route-group layout
 * DB-validated auth gate + dashboard shell wrapper.
 */
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import { listSpacesForUser } from "@/src/lib/spaces/service";
import { getAccessibleOrganizations } from "@/src/lib/spaces/access";
import DashboardShell from "@/src/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await guardAuth();
  const [workspace, spaces, organizations] = await Promise.all([
    getPrimaryWorkspace(user.id),
    listSpacesForUser(user),
    getAccessibleOrganizations(user),
  ]);

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role }}
      workspace={workspace}
      spaces={spaces}
      organizations={organizations}
    >
      {children}
    </DashboardShell>
  );
}