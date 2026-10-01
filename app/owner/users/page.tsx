/**
 * /owner/users – User Accounts management surface (Owner only)
 *
 * Displays all platform user accounts and allows manual user provisioning,
 * platform role assignment, account activation/deactivation, password reset,
 * and Organization + Team membership management.
 */
import { guardOwner } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import DashboardShell from "@/src/components/dashboard/DashboardShell";
import UserAccountsManager from "@/src/components/owner/UserAccountsManager";

export default async function OwnerUsersPage() {
  const user = await guardOwner();
  const activeSpace = await resolveActiveSpaceForUser(user);

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role }}
      spaces={activeSpace.spaces}
      organizations={activeSpace.organizations}
      activeSpaceId={activeSpace.space?.id ?? null}
      activeOrganizationId={activeSpace.organization?.id ?? null}
      activeSpaceNeedsPersistence={activeSpace.activeSpaceNeedsPersistence}
      activeSpacePreferenceInvalid={activeSpace.activeSpacePreferenceInvalid}
      activeSpaceContext={activeSpace.context}
    >
      <UserAccountsManager currentUserId={user.id} />
    </DashboardShell>
  );
}
