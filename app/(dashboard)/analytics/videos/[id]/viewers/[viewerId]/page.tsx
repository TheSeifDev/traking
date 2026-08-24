import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getSafeSpaceDisplayName } from "@/src/lib/spaces/labels";
import { getViewerVideoAnalytics } from "@/src/lib/videos/service";
import ViewerVideoAnalyticsDashboard from "@/src/components/dashboard/ViewerVideoAnalyticsDashboard";
import { EmptyAnalytics } from "@/src/components/dashboard/AnalyticsDetail";

interface Props {
  params: Promise<{ id: string; viewerId: string }>;
  searchParams?: Promise<{ space_id?: string; organization_id?: string }>;
}

export default async function ViewerVideoAnalyticsPage({ params, searchParams }: Props) {
  const { id: videoId, viewerId: encodedViewerId } = await params;
  const user = await guardAuth();
  const query = await searchParams;
  const requestedSpaceId = query?.space_id?.trim() || null;
  const requestedOrganizationId = query?.organization_id?.trim() || null;
  const resolution = await resolveActiveSpaceForUser(user, { requestedSpaceId, requestedOrganizationId });
  if (resolution.requestedSpaceInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");

  const access = resolution.access;
  const organizationScope = resolution.context.type === "all" && resolution.organization
    ? organizationDataScope(resolution.organization)
    : null;
  const spaceScope = access ? spaceDataScope(access.space) : null;
  const scope = organizationScope ?? spaceScope;
  const canManage = organizationScope ? user.role === "owner" : Boolean(access?.is_platform_owner || access?.membership?.role === "admin");
  if (!scope || !canManage) return <EmptyAnalytics title="Viewer analytics access required" body="Viewer analytics are restricted to the platform owner and active Space admins." />;

  const viewerId = decodeURIComponent(encodedViewerId);
  const analytics = await getViewerVideoAnalytics(viewerId, videoId, scope);
  if (!analytics) return <EmptyAnalytics title="Viewer/video analytics unavailable" body="This viewer and video pair is not present in the selected authorized Organization or Space." />;

  const scopeQuery = organizationScope
    ? `?organization_id=${encodeURIComponent(resolution.organization?.id ?? "")}`
    : `?space_id=${encodeURIComponent(spaceScope?.spaceId ?? "")}`;
  const viewerHref = `/analytics/viewers/${encodeURIComponent(viewerId)}${scopeQuery}`;
  const contextLabel = organizationScope
    ? `${resolution.organization?.name ?? "Organization"} / All Spaces`
    : getSafeSpaceDisplayName(access?.space.name ?? "Space", access?.organization?.name);
  return <ViewerVideoAnalyticsDashboard viewer={analytics.viewer} video={analytics.video} scopeQuery={scopeQuery} backHref={viewerHref} contextLabel={contextLabel} />;
}
