/**
 * /admin/* layout – requires admin or owner role (DB-validated).
 * Viewers arriving here (bypassing the cookie fast-path) are redirected.
 */
import { guardAdmin } from "@/src/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full DB validation – rejects unauthenticated, inactive, and viewer roles
  await guardAdmin();

  return <>{children}</>;
}
