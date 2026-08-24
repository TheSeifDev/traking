import { notFound, redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getSpaceForUser } from "@/src/lib/spaces/service";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";
import SpaceDashboard from "@/src/components/spaces/SpaceDashboard";

type PageContext = { params: Promise<{ spaceId: string }> };

export default async function SpaceDashboardPage({ params }: PageContext) {
  const user = await guardAuth();
  const { spaceId } = await params;
  let access;
  try {
    access = await getSpaceForUser(spaceId, user);
  } catch {
    redirect("/spaces?error=forbidden");
  }
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!access.space.clickup_workspace_id) {
    return <SpaceDashboard organization={access.organization} space={{ ...access.space, membership_role: access.membership?.role ?? null, membership_status: access.membership?.status ?? null, is_platform_owner: access.is_platform_owner }} analytics={null} videoCount={0} canManage={canManage} />;
  }

  const [videos, analytics] = await Promise.all([
    listVideos(access.space.clickup_workspace_id, access.space.id),
    canManage ? getWorkspaceAnalytics(access.space.clickup_workspace_id, access.space.id) : Promise.resolve(null),
  ]);
  if (!access.space) notFound();
  return <SpaceDashboard organization={access.organization} space={{ ...access.space, membership_role: access.membership?.role ?? null, membership_status: access.membership?.status ?? null, is_platform_owner: access.is_platform_owner }} analytics={analytics} videoCount={videos.length} canManage={canManage} />;
}
