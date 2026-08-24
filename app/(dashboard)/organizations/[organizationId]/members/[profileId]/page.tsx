import { notFound } from "next/navigation";
import User360Dashboard from "@/src/components/users/User360Dashboard";
import { guardAuth } from "@/src/lib/auth/guards";
import { getUser360 } from "@/src/lib/users/service";

type PageProps = {
  params: Promise<{ organizationId: string; profileId: string }>;
};

export default async function OrganizationMemberProfilePage({ params }: PageProps) {
  const user = await guardAuth();
  const { organizationId, profileId } = await params;
  let data: Awaited<ReturnType<typeof getUser360>> = null;
  try {
    data = await getUser360(profileId, { kind: "organization", id: organizationId }, user);
  } catch {
    notFound();
  }
  if (!data) notFound();
  return <User360Dashboard data={data} backHref={`/organizations/${encodeURIComponent(organizationId)}/members`} />;
}
