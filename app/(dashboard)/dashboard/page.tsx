import Link from "next/link";
import { Link2, Video as VideoIcon } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";
import DashboardOverview from "@/src/components/dashboard/DashboardOverview";
import type { Video, WorkspaceAnalytics } from "@/src/types/video";

const emptyAnalytics: WorkspaceAnalytics = {
  total_videos: 0,
  total_views: 0,
  total_sessions: 0,
  unique_viewers: 0,
  total_measurable_watch_time_seconds: null,
  avg_watch_time_seconds: null,
  avg_completion_percentage: null,
  completion_rate: null,
  playback_metrics_available: false,
  activity_over_time: [],
  top_videos_by_views: [],
  top_videos_by_watch_time: [],
  recent_activity: [],
  viewer_sessions: [],
};

export default async function DashboardPage() {
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);

  if (!workspaceId) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#08081f] p-5 sm:p-8">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl shadow-black/20 sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><VideoIcon size={26} /></div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/70">Workspace setup</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Connect your ClickUp workspace</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">TrackUp needs an authorized ClickUp workspace before it can scope videos, links, viewers, and analytics securely.</p>
          <Link href="/login" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 sm:w-auto"><Link2 size={16} />Reconnect ClickUp</Link>
        </section>
      </div>
    );
  }

  let analytics = emptyAnalytics;
  let videos: Video[] = [];
  let error: string | null = null;
  try {
    const [loadedAnalytics, loadedVideos] = await Promise.all([getWorkspaceAnalytics(workspaceId), listVideos(workspaceId)]);
    analytics = loadedAnalytics;
    videos = loadedVideos;
    if (loadedVideos.length > 0 && loadedAnalytics.total_videos === 0) error = "workspace_analytics_unavailable";
  } catch {
    error = "workspace_data_unavailable";
  }

  return <DashboardOverview user={{ name: user.name, email: user.email, role: user.role }} analytics={analytics} videos={videos} error={error} />;
}
