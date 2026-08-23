import DashboardShell from "@/src/components/dashboard/DashboardShell";
import { guardOwner } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import OwnerObservabilityConsole from "@/src/components/owner/OwnerObservabilityConsole";

export default async function OwnerObservabilityPage() {
  const user = await guardOwner();
  const workspace = await getPrimaryWorkspace(user.id);
  return (
    <DashboardShell user={user} workspace={workspace}>
      <OwnerObservabilityConsole />
    </DashboardShell>
  );
}
