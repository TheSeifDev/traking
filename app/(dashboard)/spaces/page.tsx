import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import SpacesDirectory from "@/src/components/spaces/SpacesDirectory";

type PageProps = { searchParams?: Promise<{ organization_id?: string }> };

export default async function SpacesPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const resolution = await resolveActiveSpaceForUser(user, { requestedOrganizationId: params?.organization_id?.trim() || null });
  return <SpacesDirectory spaces={resolution.spaces} organizations={resolution.organizations} role={user.role} activeSpaceId={resolution.space?.id ?? null} activeSpaceContext={resolution.context} />;
}
