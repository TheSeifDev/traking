import DashboardShell from "@/src/components/dashboard/DashboardShell";
import { guardOwner } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import OwnerObservabilityConsole from "@/src/components/owner/OwnerObservabilityConsole";

export default async function OwnerObservabilityPage() {
  const user = await guardOwner();
  const [workspace, activeSpace] = await Promise.all([
    getPrimaryWorkspace(user.id),
    resolveActiveSpaceForUser(user),
  ]);
  return (
    <DashboardShell
      user={user}
      workspace={workspace}
      spaces={activeSpace.spaces}
      organizations={activeSpace.organizations}
      activeSpaceId={activeSpace.space?.id ?? null}
      activeOrganizationId={activeSpace.organization?.id ?? null}
      activeSpaceNeedsPersistence={activeSpace.activeSpaceNeedsPersistence}
      activeSpacePreferenceInvalid={activeSpace.activeSpacePreferenceInvalid}
      activeSpaceContext={activeSpace.context}
    >
      <OwnerObservabilityConsole />
    </DashboardShell>
  );
}
