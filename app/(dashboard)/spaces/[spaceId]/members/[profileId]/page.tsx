import { notFound } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getUser360 } from "@/src/lib/users/service";
import User360Dashboard from "@/src/components/users/User360Dashboard";

type PageProps = { params: Promise<{ spaceId: string; profileId: string }> };

export default async function SpaceUserPage({ params }: PageProps) {
  const user = await guardAuth();
  const { spaceId, profileId } = await params;
  let data;
  try {
    data = await getUser360(profileId, { kind: "space", id: spaceId }, user);
  } catch {
    notFound();
  }
  if (!data) notFound();
  return <User360Dashboard data={data} backHref={`/spaces/${spaceId}/members`} analyticsScopeQuery={`?space_id=${encodeURIComponent(spaceId)}`} />;
}
