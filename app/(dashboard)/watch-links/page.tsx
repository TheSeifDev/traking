import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getAppUrl } from "@/src/lib/app-url";
import { listVideos } from "@/src/lib/videos/service";
import WatchLinksManager from "@/src/components/dashboard/WatchLinksManager";

export default async function WatchLinksPage() {
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  const videos = workspaceId ? await listVideos(workspaceId) : [];

  return <WatchLinksManager videos={videos} role={user.role} appOrigin={getAppUrl()} hasWorkspace={Boolean(workspaceId)} />;
}
