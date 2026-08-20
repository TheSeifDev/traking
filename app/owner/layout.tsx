/**
 * /owner/* layout – requires owner role ONLY (DB-validated).
 * Admin, viewer, unauthenticated, and inactive users are redirected.
 */
import { guardOwner } from "@/src/lib/auth/guards";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full DB validation – rejects everyone except active owners
  await guardOwner();

  return <>{children}</>;
}
