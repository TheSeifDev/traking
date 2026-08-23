import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getSpaceForUser, listSpacesForUser } from "@/src/lib/spaces/service";
import { getAppUrl } from "@/src/lib/app-url";
import { listVideos } from "@/src/lib/videos/service";
import WatchLinksManager from "@/src/components/dashboard/WatchLinksManager";

type PageProps = { searchParams?: Promise<{ space_id?: string }> };

export default async function WatchLinksPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const requestedSpaceId = params?.space_id?.trim() || null;
  let access;
  if (requestedSpaceId) {
    try {
      access = await getSpaceForUser(requestedSpaceId, user);
    } catch {
      redirect("/spaces?error=forbidden");
    }
  } else {
    const spaces = await listSpacesForUser(user);
    if (spaces.length > 1) redirect("/spaces?error=select_space");
    if (!spaces[0]) return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} />;
    try {
      access = await getSpaceForUser(spaces[0].id, user);
    } catch {
      redirect("/spaces?error=forbidden");
    }
  }

  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!access.space.clickup_workspace_id) {
    return <WatchLinksManager videos={[]} role={user.role} appOrigin={getAppUrl()} hasWorkspace={false} spaceId={access.space.id} spaceCanManage={canManage} />;
  }
  const videos = await listVideos(access.space.clickup_workspace_id, access.space.id);
  return <WatchLinksManager videos={videos} role={user.role} appOrigin={getAppUrl()} hasWorkspace={true} spaceId={access.space.id} spaceCanManage={canManage} />;
}
