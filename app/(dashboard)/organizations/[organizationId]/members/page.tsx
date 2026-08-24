import { notFound } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getOrganizationForUser, listOrganizationMembers } from "@/src/lib/organizations/service";
import OrganizationMembersManager from "@/src/components/organizations/OrganizationMembersManager";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function OrganizationMembersPage({ params }: PageProps) {
  const user = await guardAuth();
  const { organizationId } = await params;
  let access;
  let members;
  try {
    access = await getOrganizationForUser(organizationId, user);
    members = await listOrganizationMembers(organizationId, user);
  } catch {
    notFound();
  }
  if (!access || !members) notFound();

  return <OrganizationMembersManager organizationId={organizationId} organizationName={access.organization.name} currentUserId={user.id} initialMembers={members} />;
}
