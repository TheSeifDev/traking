import { notFound } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getOrganizationForUser, listOrganizationSpaces } from "@/src/lib/organizations/service";
import OrganizationDashboard from "@/src/components/organizations/OrganizationDashboard";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function OrganizationPage({ params }: PageProps) {
  const user = await guardAuth();
  const { organizationId } = await params;
  let access;
  let spaces;
  try {
    access = await getOrganizationForUser(organizationId, user);
    spaces = await listOrganizationSpaces(organizationId, user);
  } catch {
    notFound();
  }
  if (!access || !spaces) notFound();
  return <OrganizationDashboard organization={access.organization} spaces={spaces} membership={access.membership} isPlatformOwner={access.is_platform_owner} />;
}
