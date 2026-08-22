/**
 * /dashboard - Overview page
 */
import Link from "next/link";
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";
import { Eye, Video, TrendingUp, Clock, Plus } from "lucide-react";

export default async function DashboardPage() {
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);

  if (!workspaceId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-full text-center">
        <div className="mb-6 h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
          <Video size={28} className="text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to TrackUp</h1>
        <p className="text-white/50 mb-6 max-w-sm">
          No ClickUp workspace connected yet. Log out and log in again with ClickUp to connect your workspace.
        </p>
        <Link href="/login" className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
          Reconnect ClickUp
        </Link>
      </div>
    );
  }

  const [analytics, videos] = await Promise.all([
    getWorkspaceAnalytics(workspaceId),
    listVideos(workspaceId),
  ]);

  const recentVideos = videos.slice(0, 5);

  const stats = [
    { label: "Total Videos", value: analytics.total_videos, icon: Video, color: "from-violet-500 to-blue-500" },
    { label: "Total Views", value: analytics.total_views, icon: Eye, color: "from-blue-500 to-cyan-500" },
    { label: "Unique Viewers", value: analytics.unique_viewers, icon: TrendingUp, color: "from-cyan-500 to-teal-500" },
    { label: "Avg. Completion", value: `${analytics.avg_completion_percentage}%`, icon: Clock, color: "from-teal-500 to-green-500" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-white/50 text-sm mt-1">Welcome back, {user.name ?? user.email}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-5 flex flex-col gap-3">
            <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
              <Icon size={16} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/40 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent videos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Recent Videos</h2>
          <Link href="/videos" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
            View all
          </Link>
        </div>
        {recentVideos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 flex flex-col items-center text-center">
            <Video size={32} className="text-white/20 mb-3" />
            <p className="text-white/40 text-sm mb-4">No videos yet. Create your first video to get started.</p>
            <Link
              href="/videos"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
            >
              <Plus size={14} />
              Add Video
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentVideos.map((v) => (
              <Link
                key={v.id}
                href={`/videos/${v.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/4 border border-white/8 hover:bg-white/6 hover:border-white/12 transition-all group"
              >
                <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Video size={15} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-violet-200 transition-colors">{v.title}</p>
                  <p className="text-xs text-white/40 mt-0.5 capitalize">{v.source_type.replace("_", " ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-white">{v.view_count ?? 0}</p>
                  <p className="text-xs text-white/40">views</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}