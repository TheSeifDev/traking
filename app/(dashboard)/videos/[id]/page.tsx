/**
 * /videos/[id] - Single video analytics + detail page
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getVideo, getVideoAnalytics } from "@/src/lib/videos/service";
import { ArrowLeft, Eye, Clock, TrendingUp, CheckCircle, ExternalLink } from "lucide-react";
import WatchLinkPanel from "@/src/components/dashboard/WatchLinkPanel";

type Props = { params: Promise<{ id: string }> };

export default async function VideoDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) notFound();

  const [video, analytics] = await Promise.all([
    getVideo(id, workspaceId),
    getVideoAnalytics(id, workspaceId),
  ]);

  if (!video) notFound();

  const canManage = user.role === "owner" || user.role === "admin";
  const currentTime = new Date().getTime();
  const activeLink = video.watch_links?.find((link) => {
    const expired = Boolean(link.expires_at && new Date(link.expires_at).getTime() <= currentTime);
    return !link.revoked_at && !expired;
  });

  const stats = analytics ? [
    { label: "Total Views", value: analytics.total_views, icon: Eye },
    { label: "Unique Viewers", value: analytics.unique_viewers, icon: TrendingUp },
    {
      label: "Avg Watch Time",
      value: analytics.avg_watch_time_seconds === null
        ? "Unavailable"
        : `${Math.floor(analytics.avg_watch_time_seconds / 60)}m ${analytics.avg_watch_time_seconds % 60}s`,
      icon: Clock,
    },
    {
      label: "Avg Completion",
      value: analytics.avg_completion_percentage === null ? "Unavailable" : `${analytics.avg_completion_percentage}%`,
      icon: CheckCircle,
    },
  ] : [];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/videos" className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{video.title}</h1>
            <p className="text-sm text-white/40 capitalize">{video.source_type.replace("_", " ")}</p>
          </div>
          {activeLink && (
            <Link href={`/watch/${activeLink.token}`} target="_blank" className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600/15 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-600/25">
              <ExternalLink size={14} /> Open viewer
            </Link>
          )}
        </div>

        <div className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-white/30">Video source</p>
            <p className="mt-2 break-all text-sm text-white/70">{video.source_url}</p>
            {video.description && <p className="mt-2 text-sm leading-6 text-white/40">{video.description}</p>}
          </div>
          <div className="rounded-xl border border-white/8 bg-black/10 px-4 py-3 text-center">
            <p className="text-lg font-semibold text-white">{video.duration ? `${Math.floor(video.duration / 60)}m ${video.duration % 60}s` : "—"}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/35">Duration</p>
          </div>
        </div>

      {/* Stats */}
      {analytics && (
        <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-white/4 border border-white/8 p-4">
              <Icon size={15} className="text-violet-400 mb-2" />
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/35">
          {analytics.playback_metrics_scope === "direct_url_native_html5"
            ? "Playback time and completion are measured from native HTML5 events."
            : "This provider exposes session start/end only; playback position, watch time, and completion are not measured."}
        </p>
        </>
      )}

      {/* Watch Link */}
      <WatchLinkPanel videoId={video.id} existingLinks={video.watch_links ?? []} canManage={canManage} />

      {/* Recent sessions */}
      {analytics && analytics.recent_sessions.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Recent Viewers</h2>
          <div className="space-y-2">
            {analytics.recent_sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/4 border border-white/8">
                <div className="h-8 w-8 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                  <Eye size={13} className="text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70">{s.viewer_identifier ? `Viewer ${s.viewer_identifier.slice(0, 8)}` : "Anonymous"}</p>
                  <p className="text-xs text-white/40">{new Date(s.started_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-white">{s.completion_percentage === null ? "Not measured" : `${s.completion_percentage}%`}</p>
                  <p className="text-xs text-white/40">{s.watch_time_seconds === null ? "Playback telemetry unavailable" : `${Math.floor(s.watch_time_seconds / 60)}m ${s.watch_time_seconds % 60}s`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!analytics || analytics.total_views === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <Eye size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No views yet. Share the watch link to start tracking.</p>
        </div>
      ) : null}
    </div>
  );
}