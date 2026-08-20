/**
 * Dashboard route-group layout
 * DB-validated auth gate: redirects to /login if unauthenticated or inactive.
 */
import { guardAuth } from "@/src/lib/auth/guards";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full DB validation – runs on every dashboard page render
  await guardAuth();

  return <>{children}</>;
}
