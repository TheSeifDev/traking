/**
 * /analytics - Workspace-level analytics
 */
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";
import { Eye, Users, TrendingUp, Clock, BarChart3, Video } from "lucide-react";

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

  const stats = [
    { label: "Total Views", value: analytics.total_views, icon: Eye, desc: "Across all videos" },
    { label: "Unique Viewers", value: analytics.unique_viewers, icon: Users, desc: "Distinct sessions" },
    { label: "Avg Completion", value: analytics.avg_completion_percentage === null ? "Unavailable" : `${analytics.avg_completion_percentage}%`, icon: Clock, desc: "Direct URL playback only"},
    { label: "Completion Rate", value: analytics.completion_rate === null ? "Unavailable" : `${analytics.completion_rate}%`, icon: TrendingUp, desc: "Measured direct URL sessions" },
  ];

  const topVideos = videos
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 10);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={20} className="text-violet-400" />
          Analytics
        </h1>
        <p className="text-white/40 text-sm mt-1">Workspace-wide video performance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, desc }) => (
          <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-5">
            <Icon size={16} className="text-violet-400 mb-3" />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs font-medium text-white/60 mt-0.5">{label}</p>
            <p className="text-[11px] text-white/30 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Top videos by views */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Videos by Views</h2>
        {topVideos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <Video size={28} className="text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No video data yet. Share watch links to start collecting analytics.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topVideos.map((v, i) => {
              const maxViews = topVideos[0].view_count ?? 1;
              const pct = maxViews > 0 ? ((v.view_count ?? 0) / maxViews) * 100 : 0;
              return (
                <div key={v.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/4 border border-white/8">
                  <span className="text-sm text-white/30 w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{v.title}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{v.view_count ?? 0}</p>
                    <p className="text-[11px] text-white/40">{v.avg_completion === null ? "Not measured" : `${v.avg_completion}% avg`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}