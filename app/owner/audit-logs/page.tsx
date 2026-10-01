import DashboardShell from "@/src/components/dashboard/DashboardShell";
import AuditLogsConsole from "@/src/components/owner/AuditLogsConsole";
import { guardOwner } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";

export default async function AuditLogsPage() {
  const user = await guardOwner();
  const activeSpace = await resolveActiveSpaceForUser(user);

  return <DashboardShell user={user} spaces={activeSpace.spaces} organizations={activeSpace.organizations} activeSpaceId={activeSpace.space?.id ?? null} activeOrganizationId={activeSpace.organization?.id ?? null} activeSpaceNeedsPersistence={activeSpace.activeSpaceNeedsPersistence} activeSpacePreferenceInvalid={activeSpace.activeSpacePreferenceInvalid} activeSpaceContext={activeSpace.context}><AuditLogsConsole /></DashboardShell>;
}
