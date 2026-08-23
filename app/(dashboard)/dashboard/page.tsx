import Link from "next/link";
import { Activity, ArrowRight, BarChart3, Clock3, Eye, Link2, Plus, ShieldCheck, UsersRound, Video } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not measured";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function sourceLabel(sourceType: string): string {
  return sourceType === "direct_url" ? "Direct URL" : sourceType.replace("_", " ");
}

export default async function DashboardPage() {
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);

  if (!workspaceId) {
    return (
      <div className="flex min-h-full items-center justify-center p-5 sm:p-8">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl shadow-black/20 sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><Video size={26} /></div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/70">Workspace setup</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Connect your ClickUp workspace</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">TrackUp needs an authorized ClickUp workspace before it can scope videos, links, viewers, and analytics securely.</p>
          <Link href="/login" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 sm:w-auto"><Link2 size={16} />Reconnect ClickUp</Link>
        </section>
      </div>
    );
  }

  const [analytics, videos] = await Promise.all([getWorkspaceAnalytics(workspaceId), listVideos(workspaceId)]);
  const recentVideos = videos.slice(0, 4);
  const recentActivity = analytics.recent_activity.slice(0, 5);
  const now = new Date().getTime();
  const maxActivity = Math.max(...analytics.activity_over_time.map((point) => point.sessions), 1);
  const canManage = user.role === "owner" || user.role === "admin";
  const activeLinks = videos.reduce((total, video) => total + (video.watch_links?.filter((link) => !link.revoked_at && !(link.expires_at && new Date(link.expires_at).getTime() <= now)).length ?? 0), 0);

  const metrics = [
    { label: "Total videos", value: analytics.total_videos, detail: "Workspace library", icon: Video, tone: "violet" },
    { label: "Real sessions", value: analytics.total_sessions, detail: "Recorded visits", icon: Eye, tone: "cyan" },
    { label: "Unique viewers", value: analytics.unique_viewers, detail: "Hashed identities", icon: UsersRound, tone: "teal" },
    { label: "Measured watch time", value: formatDuration(analytics.total_measurable_watch_time_seconds), detail: analytics.playback_metrics_available ? "Native/API telemetry" : "Awaiting playback telemetry", icon: Clock3, tone: "amber" },
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_34%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7 lg:space-y-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/70">Workspace command center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Good to see you, {user.name ?? user.email.split("@")[0]}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">A truthful view of your TrackUp workspace: what was added, what was watched, and what playback telemetry is actually measurable.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/analytics" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"><BarChart3 size={16} />Open analytics</Link>
            {canManage && <Link href="/videos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500"><Plus size={16} />Add video</Link>}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          {metrics.map(({ label, value, detail, icon: Icon, tone }) => {
            const toneClass = tone === "violet" ? "bg-violet-500/15 text-violet-300" : tone === "cyan" ? "bg-cyan-500/15 text-cyan-300" : tone === "teal" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300";
            return <article key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 shadow-xl shadow-black/10 sm:p-5"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}><Icon size={17} /></div><p className="mt-5 truncate text-2xl font-semibold text-white sm:text-3xl">{value}</p><p className="mt-1 text-xs font-medium text-white/65">{label}</p><p className="mt-1 text-[11px] text-white/30">{detail}</p></article>;
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Watch activity</p><h2 className="mt-2 text-lg font-semibold text-white">Sessions over time</h2></div><Link href="/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200">View report <ArrowRight size={13} /></Link></div>
            {analytics.activity_over_time.length === 0 ? <div className="mt-8 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">Activity will appear here after a viewer opens a TrackUp link.</div> : <div className="mt-7 flex min-h-44 items-end gap-2 overflow-x-auto pb-1 sm:gap-3">{analytics.activity_over_time.slice(-14).map((point) => <div key={point.date} className="flex min-w-7 flex-1 flex-col items-center gap-2 sm:min-w-9"><div className="flex h-32 w-full items-end justify-center rounded-lg bg-white/[0.025] px-1"><div className="w-full rounded-md bg-gradient-to-t from-violet-600 to-cyan-400 transition-all" style={{ height: `${Math.max(8, (point.sessions / maxActivity) * 100)}%` }} title={`${point.sessions} sessions`} /></div><span className="text-[9px] text-white/35">{point.date.slice(5)}</span><span className="text-[10px] font-semibold text-white/60">{point.sessions}</span></div>)}</div>}
          </article>

          <article className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Access health</p><h2 className="mt-2 text-lg font-semibold text-white">Viewer links</h2></div><Link href="/watch-links" className="text-xs font-medium text-violet-300 hover:text-violet-200">Manage</Link></div><div className="mt-7 flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300"><Link2 size={23} /></div><div><p className="text-3xl font-semibold text-white">{activeLinks}</p><p className="text-sm text-white/45">active TrackUp links</p></div></div><div className="mt-7 flex items-start gap-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-3 text-xs leading-5 text-white/45"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-violet-300" /><span>Each video supports one active viewer link. Revoked history remains auditable.</span></div></article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Library pulse</p><h2 className="mt-2 text-lg font-semibold text-white">Recent videos</h2></div><Link href="/videos" className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200">View library <ArrowRight size={13} /></Link></div>{recentVideos.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">Your library is ready for its first video.</div> : <div className="mt-5 space-y-2">{recentVideos.map((video) => <Link key={video.id} href={`/videos/${video.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/6 bg-black/10 p-3 transition hover:border-violet-400/25 hover:bg-white/[0.04]"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><Video size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{video.title}</p><p className="mt-1 text-xs capitalize text-white/35">{sourceLabel(video.source_type)} · {video.view_count ?? 0} sessions</p></div><ArrowRight size={15} className="shrink-0 text-white/25" /></Link>)}</div>}</article>

          <article className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Viewer activity</p><h2 className="mt-2 text-lg font-semibold text-white">Recent sessions</h2></div>{recentActivity.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">No viewer sessions recorded yet.</div> : <div className="mt-5 space-y-3">{recentActivity.map((session) => <div key={session.session_id} className="flex min-w-0 items-start gap-3"><div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300"><Activity size={13} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm text-white/80">{session.video_title}</p><p className="mt-1 truncate text-xs text-white/35">Viewer {session.viewer_identifier ?? "unidentified"} · {new Date(session.started_at).toLocaleString()}</p></div><span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/40">{session.playback_events.length} events</span></div>)}</div>}</article>
        </section>
      </div>
    </div>
  );
}
