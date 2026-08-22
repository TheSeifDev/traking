/**
 * Dashboard route-group layout
 * DB-validated auth gate + dashboard shell wrapper.
 */
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import DashboardShell from "@/src/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await guardAuth();
  const workspace = await getPrimaryWorkspace(user.id);

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, role: user.role }}
      workspace={workspace}
    >
      {children}
    </DashboardShell>
  );
}