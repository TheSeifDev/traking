import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, BarChart3, Clock3, Eye, Layers3, UsersRound } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getOrganizationForUser, listOrganizationSpaces } from "@/src/lib/organizations/service";
import { getWorkspaceAnalytics } from "@/src/lib/videos/service";
import type { WorkspaceAnalytics } from "@/src/types/video";

function duration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not measured";
  const seconds = Math.max(0, Math.round(value));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function aggregate(analytics: WorkspaceAnalytics[]): WorkspaceAnalytics {
  const sessions = analytics.flatMap((item) => item.viewer_sessions);
  const measured = sessions.filter((session) => session.watch_time_seconds !== null);
  const viewers = new Set(sessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? session.session_id));
  const videoMap = new Map<string, { video_id: string; title: string; source_type: WorkspaceAnalytics["top_videos_by_views"][number]["source_type"]; total_views: number; measurable_watch_time_seconds: number | null }>();
  for (const item of analytics) {
    for (const video of item.top_videos_by_views) {
      const current = videoMap.get(video.video_id);
      if (!current) videoMap.set(video.video_id, { ...video });
      else {
        current.total_views += video.total_views;
        const values = [current.measurable_watch_time_seconds, video.measurable_watch_time_seconds].filter((value): value is number => value !== null);
        current.measurable_watch_time_seconds = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
      }
    }
  }
  const totalWatch = measured.length > 0 ? measured.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0) : null;
  const completionValues = measured.map((session) => session.completion_percentage).filter((value): value is number => value !== null);
  const completed = completionValues.length > 0 ? completionValues.filter((value) => value >= 90).length / completionValues.length * 100 : null;
  return {
    total_videos: new Set(analytics.flatMap((item) => item.top_videos_by_views.map((video) => video.video_id))).size,
    total_views: sessions.length,
    total_sessions: sessions.length,
    unique_viewers: viewers.size,
    total_measurable_watch_time_seconds: totalWatch,
    avg_watch_time_seconds: measured.length > 0 ? (totalWatch ?? 0) / measured.length : null,
    avg_completion_percentage: completionValues.length > 0 ? completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length : null,
    completion_rate: completed,
    playback_metrics_available: measured.length > 0,
    activity_over_time: [],
    top_videos_by_views: [...videoMap.values()].sort((left, right) => right.total_views - left.total_views),
    top_videos_by_watch_time: [],
    recent_activity: sessions.slice().sort((left, right) => new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime()).slice(0, 12),
    viewer_sessions: sessions,
    viewers: [],
    telemetry_health: {
      measured_sessions: sessions.filter((session) => session.telemetry_state === "measured").length,
      missing_sessions: sessions.filter((session) => session.telemetry_state === "missing").length,
      unsupported_sessions: sessions.filter((session) => session.telemetry_state === "unsupported").length,
    },
  };
}

export default async function OrganizationAnalyticsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const user = await guardAuth();
  const { organizationId } = await params;
  let access;
  let spaces;
  try {
    access = await getOrganizationForUser(organizationId, user);
    spaces = await listOrganizationSpaces(organizationId, user);
  } catch {
    notFound();
  }
  if (!access || !spaces) notFound();
  const spaceAnalytics = await Promise.all(spaces.flatMap((space) => typeof space.clickup_workspace_id === "string" ? [getWorkspaceAnalytics(space.clickup_workspace_id, space.id)] : []));
  const analytics = aggregate(spaceAnalytics);
  return <main className="min-h-full bg-[#08081f] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1200px] space-y-7"><Link href={`/organizations/${organizationId}`} className="text-xs text-violet-300 hover:text-violet-200">← {access.organization.name}</Link><header className="border-b border-white/8 pb-7"><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Organization analytics</p><h1 className="mt-3 text-3xl font-semibold text-white">{access.organization.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Organization-level totals across the Spaces visible to this account. ClickUp-unlinked Spaces are not presented as measured analytics.</p></header><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Views" value={analytics.total_views} icon={Eye} /><Metric label="Unique viewers" value={analytics.unique_viewers} icon={UsersRound} /><Metric label="Sessions" value={analytics.total_sessions} icon={Layers3} /><Metric label="Measured watch time" value={duration(analytics.total_measurable_watch_time_seconds)} icon={Clock3} /></section><section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-white/30">Top videos</p><h2 className="mt-2 text-lg font-semibold">Across this Organization</h2></div><BarChart3 size={18} className="text-violet-300" /></div>{analytics.top_videos_by_views.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No persisted analytics are available yet.</p> : <div className="mt-5 space-y-3">{analytics.top_videos_by_views.slice(0, 10).map((video) => <div key={video.video_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/7 bg-black/10 px-3 py-3"><span className="min-w-0 truncate text-sm text-white/75">{video.title}</span><span className="shrink-0 text-xs text-violet-200">{video.total_views} views</span></div>)}</div>}</article><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-white/30">Measurement</p><h2 className="mt-2 text-lg font-semibold">Provider-honest state</h2></div><Activity size={18} className="text-cyan-300" /></div><div className="mt-5 space-y-3 text-sm text-white/55"><p>Measured sessions <span className="float-right text-white/80">{analytics.telemetry_health?.measured_sessions ?? 0}</span></p><p>Missing telemetry <span className="float-right text-white/80">{analytics.telemetry_health?.missing_sessions ?? 0}</span></p><p>Unsupported provider <span className="float-right text-white/80">{analytics.telemetry_health?.unsupported_sessions ?? 0}</span></p><p>Average watch time <span className="float-right text-white/80">{duration(analytics.avg_watch_time_seconds)}</span></p><p>Completion rate <span className="float-right text-white/80">{analytics.completion_rate === null ? "Not measured" : `${Math.round(analytics.completion_rate)}%`}</span></p></div></article></section><section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-white/30">Space context</p><h2 className="mt-2 text-lg font-semibold">Organization Spaces</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{spaces.map((space) => <Link key={space.id} href={`/spaces/${space.id}/analytics`} className="rounded-2xl border border-white/8 bg-black/10 p-4 transition hover:border-violet-300/30"><p className="font-medium text-white">{space.name}</p><p className="mt-1 text-xs text-white/40">{space.clickup_workspace_id ? "Analytics available when persisted" : "ClickUp link optional; provider analytics not measured"}</p></Link>)}</div></section></div></main>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Eye }) {
  return <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"><Icon size={17} className="text-violet-200" /><p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-white/35">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p></article>;
}
