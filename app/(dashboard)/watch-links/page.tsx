import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { getAppUrl } from "@/src/lib/app-url";
import { listVideos } from "@/src/lib/videos/service";
import WatchLinksManager from "@/src/components/dashboard/WatchLinksManager";

type PageProps = { searchParams?: Promise<{ space_id?: string }> };

export default async function WatchLinksPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const requestedSpaceId = params?.space_id?.trim() || null;
  const resolution = await resolveActiveSpaceForUser(user, { requestedSpaceId });
  if (resolution.requestedSpaceInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");
  if (!resolution.access) return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} />;
  const access = resolution.access;
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!access.space.clickup_workspace_id) {
    return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} spaceId={access.space.id} spaceCanManage={canManage} />;
  }
  const videos = await listVideos(access.space.clickup_workspace_id, access.space.id);
  return <WatchLinksManager videos={videos} role={user.role} appOrigin={getAppUrl()} hasWorkspace={true} spaceId={access.space.id} spaceCanManage={canManage} />;
}
