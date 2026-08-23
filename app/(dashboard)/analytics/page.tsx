"use server";

import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";
import WorkspaceAnalyticsDashboard from "@/src/components/dashboard/WorkspaceAnalyticsDashboard";

export default async function AnalyticsPage() {
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);

  if (!workspaceId) {
    return (
      <div className="p-8 text-center">
        <p className="text-white/40">No workspace connected. Please reconnect ClickUp.</p>
      </div>
    );
  }

  const [analytics, videos] = await Promise.all([
    getWorkspaceAnalytics(workspaceId),
    listVideos(workspaceId),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <WorkspaceAnalyticsDashboard analytics={analytics} videos={videos} />
    </div>
  );
}
