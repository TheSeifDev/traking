/** /admin/users – shared owner/admin Team Members controls */
import { guardOwner } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import DashboardShell from "@/src/components/dashboard/DashboardShell";
import TeamMemberManager from "@/src/components/dashboard/TeamMemberManager";

export default async function AdminUsersPage() {
  const user = await guardOwner();
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
      <TeamMemberManager currentUserId={user.id} />
    </DashboardShell>
  );
}
