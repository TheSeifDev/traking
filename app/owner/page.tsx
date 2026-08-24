import DashboardShell from "@/src/components/dashboard/DashboardShell";
import { guardOwner } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import { getAccessibleOrganizations } from "@/src/lib/spaces/access";
import { listSpacesForUser } from "@/src/lib/spaces/service";
import OwnerObservabilityConsole from "@/src/components/owner/OwnerObservabilityConsole";

export default async function OwnerObservabilityPage() {
  const user = await guardOwner();
  const [workspace, spaces, organizations] = await Promise.all([
    getPrimaryWorkspace(user.id),
    listSpacesForUser(user),
    getAccessibleOrganizations(user),
  ]);
  return (
    <DashboardShell user={user} workspace={workspace} spaces={spaces} organizations={organizations}>
      <OwnerObservabilityConsole />
    </DashboardShell>
  );
}
