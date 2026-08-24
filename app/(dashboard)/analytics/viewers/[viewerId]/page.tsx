import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getViewerAnalytics } from "@/src/lib/videos/service";
import ViewerAnalyticsDashboard from "@/src/components/dashboard/ViewerAnalyticsDashboard";
import { EmptyAnalytics } from "@/src/components/dashboard/AnalyticsDetail";

interface Props {
  params: Promise<{ viewerId: string }>;
  searchParams?: Promise<{ space_id?: string; organization_id?: string; tab?: string }>;
}

const allowedTabs = new Set(["overview", "videos", "sessions", "timeline", "heatmap", "activity"]);

export default async function ViewerAnalyticsPage({ params, searchParams }: Props) {
  const { viewerId: encodedViewerId } = await params;
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
  const analytics = await getViewerAnalytics(viewerId, scope);
  if (!analytics) return <EmptyAnalytics title="Viewer analytics unavailable" body="This viewer has no persisted activity in the selected authorized Organization or Space." />;

  const scopeQuery = organizationScope
    ? `?organization_id=${encodeURIComponent(resolution.organization?.id ?? "")}`
    : `?space_id=${encodeURIComponent(spaceScope?.spaceId ?? "")}`;
  const backHref = `/analytics${scopeQuery}`;
  const initialTab = query?.tab && allowedTabs.has(query.tab) ? query.tab as "overview" | "videos" | "sessions" | "timeline" | "heatmap" | "activity" : "videos";

  return <ViewerAnalyticsDashboard data={analytics} scopeQuery={scopeQuery} backHref={backHref} initialTab={initialTab} />;
}
