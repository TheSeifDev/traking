import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getAppUrl } from "@/src/lib/app-url";
import { listVideos } from "@/src/lib/videos/service";
import WatchLinksManager from "@/src/components/dashboard/WatchLinksManager";

type PageProps = { searchParams?: Promise<{ space_id?: string; organization_id?: string }> };

export default async function WatchLinksPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const resolution = await resolveActiveSpaceForUser(user, {
    requestedSpaceId: params?.space_id?.trim() || null,
    requestedOrganizationId: params?.organization_id?.trim() || null,
  });
  if (resolution.requestedSpaceInvalid || resolution.requestedOrganizationInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");

  if (resolution.context.type === "all") {
    const organization = resolution.organization;
    if (!organization) return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} spaceCanManage={false} />;
    const scope = organizationDataScope(organization);
    if (!scope) return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} spaceCanManage={false} />;
    const videos = await listVideos(scope);
    return <WatchLinksManager videos={videos} role={user.role} appOrigin={getAppUrl()} hasWorkspace={true} spaceId={null} organizationId={organization.id} spaceCanManage={false} />;
  }

  if (!resolution.access) return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} />;
  const access = resolution.access;
  const scope = access ? spaceDataScope(access.space) : null;
  const canManage = Boolean(access?.is_platform_owner || access?.membership?.role === "admin");
  if (!access || !scope) {
    return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} spaceId={access?.space.id} spaceCanManage={canManage} />;
  }
  const videos = await listVideos(scope);
  return <WatchLinksManager videos={videos} role={user.role} appOrigin={getAppUrl()} hasWorkspace={true} spaceId={access.space.id} spaceCanManage={canManage} />;
}
