/** /admin/users – shared owner/admin Team Members controls */
import { guardAdmin } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import DashboardShell from "@/src/components/dashboard/DashboardShell";
import TeamMemberManager from "@/src/components/dashboard/TeamMemberManager";

export default async function AdminUsersPage() {
  const user = await guardAdmin();
  const workspace = await getPrimaryWorkspace(user.id);

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role }}
      workspace={workspace}
    >
      <TeamMemberManager currentUserId={user.id} />
    </DashboardShell>
  );
}
