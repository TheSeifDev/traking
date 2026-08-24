import { guardAuth } from "@/src/lib/auth/guards";
import { listOrganizationsForUser } from "@/src/lib/organizations/service";
import OrganizationsDirectory from "@/src/components/organizations/OrganizationsDirectory";

export default async function OrganizationsPage() {
  const user = await guardAuth();
  const organizations = await listOrganizationsForUser(user);
  return <OrganizationsDirectory organizations={organizations} />;
}
