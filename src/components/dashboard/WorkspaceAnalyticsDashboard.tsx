"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Clock3,
  Eye,
  Layers3,
  PlayCircle,
  TrendingUp,
  Users,
  Video as VideoIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ViewerAnalyticsPanel from "@/src/components/dashboard/ViewerAnalyticsPanel";
import type { Video, ViewerSessionAnalytics, WorkspaceAnalytics } from "@/src/types/video";
import { getProviderLabel } from "@/src/lib/playback/providers";
import { TrackUpContent, TrackUpPageShell, TrackUpSurface } from "@/src/components/ui/trackup";

interface WorkspaceAnalyticsDashboardProps {
  analytics: WorkspaceAnalytics;
  videos: Video[];
  spaceId: string | null;
  organizationId?: string | null;
  scopeType?: "specific" | "all";
}

type DateRange = "7" | "30" | "all";
type Section = "overview" | "sessions" | "viewers" | "videos" | "engagement";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not measured";
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  return `${Math.floor(safe / 60)}m ${safe % 60}s`;
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function providerLabel(sourceType: Video["source_type"]): string {
  return getProviderLabel(sourceType);
}

export default function WorkspaceAnalyticsDashboard({
  analytics,
  videos,
  spaceId,
  organizationId = null,
  scopeType = "specific",
}: WorkspaceAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30");
  const [videoFilter, setVideoFilter] = useState("all");
  const [section, setSection] = useState<Section>("overview");
  const [now] = useState(() => Date.now());
  const scoped = (path: string) => {
    const parameter = spaceId ? `space_id=${encodeURIComponent(spaceId)}` : organizationId ? `organization_id=${encodeURIComponent(organizationId)}` : "";
    return parameter ? `${path}?${parameter}` : path;
  };

  const filteredSessions = useMemo(() => {
    const cutoff = dateRange === "all"
      ? null
      : now - Number(dateRange) * 24 * 60 * 60 * 1000;
    return analytics.viewer_sessions.filter((session) => {
      if (videoFilter !== "all" && session.video_id !== videoFilter) return false;
      if (cutoff !== null && new Date(session.started_at).getTime() < cutoff) return false;
      return true;
    });
  }, [analytics.viewer_sessions, dateRange, now, videoFilter]);

  const measurableSessions = filteredSessions.filter((session) => session.has_playback_telemetry && session.telemetry_state === "measured");
  const measuredCompletions = measurableSessions.filter((session) => session.completion_percentage !== null);
  const totalWatchTime = measurableSessions.length > 0
    ? measurableSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)
    : null;
  const averageWatchTime = measurableSessions.length > 0 ? (totalWatchTime ?? 0) / measurableSessions.length : null;
  const averageCompletion = measuredCompletions.length > 0
    ? Math.round(measuredCompletions.reduce((sum, session) => sum + (session.completion_percentage ?? 0), 0) / measuredCompletions.length)
    : null;
  const completionRate = measuredCompletions.length > 0
    ? Math.round((measuredCompletions.filter((session) => (session.completion_percentage ?? 0) >= 90).length / measuredCompletions.length) * 100)
    : null;
  const uniqueViewers = new Set(filteredSessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`)).size;

  const activity = useMemo(() => {
    const byDate = new Map<string, { date: string; views: number; sessions: number }>();
    for (const session of filteredSessions) {
      const date = session.started_at.slice(0, 10);
      const current = byDate.get(date) ?? { date, views: 0, sessions: 0 };
      current.views += 1;
      current.sessions += 1;
      byDate.set(date, current);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSessions]);

  const summaries = useMemo(() => {
    const byVideo = new Map<string, {
      video_id: string;
      space_id?: string | null;
      title: string;
      source_type: Video["source_type"];
      total_views: number;
      measurable_watch_time_seconds: number | null;
    }>();
    for (const session of filteredSessions) {
      const current = byVideo.get(session.video_id) ?? {
        video_id: session.video_id,
        space_id: session.space_id ?? null,
        title: session.video_title,
        source_type: session.source_type,
        total_views: 0,
        measurable_watch_time_seconds: null,
      };
      current.total_views += 1;
      if (session.has_playback_telemetry && session.telemetry_state === "measured" && session.watch_time_seconds !== null) {
        current.measurable_watch_time_seconds = (current.measurable_watch_time_seconds ?? 0) + session.watch_time_seconds;
      }
      byVideo.set(session.video_id, current);
    }
    return Array.from(byVideo.values());
  }, [filteredSessions]);

  const topByViews = summaries.slice().sort((a, b) => b.total_views - a.total_views || a.title.localeCompare(b.title)).slice(0, 8);
  const topByWatchTime = summaries
    .filter((summary) => summary.measurable_watch_time_seconds !== null)
    .sort((a, b) => (b.measurable_watch_time_seconds ?? 0) - (a.measurable_watch_time_seconds ?? 0))
    .slice(0, 8);
  const recentActivity = filteredSessions.slice().sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()).slice(0, 8);
  const maxViews = Math.max(1, ...topByViews.map((video) => video.total_views));
  const maxWatchTime = Math.max(1, ...topByWatchTime.map((video) => video.measurable_watch_time_seconds ?? 0));

  const stats = [
    { label: "Views", value: filteredSessions.length.toLocaleString(), note: "Real watch sessions", icon: Eye, color: "text-violet-300" },
    { label: "Unique viewers", value: uniqueViewers.toLocaleString(), note: "Authenticated profiles or legacy anonymous IDs", icon: Users, color: "text-blue-300" },
    { label: "Sessions", value: filteredSessions.length.toLocaleString(), note: "One record per visit", icon: Layers3, color: "text-cyan-300" },
    { label: "Measured watch time", value: formatDuration(totalWatchTime), note: "Direct URL + YouTube API", icon: Clock3, color: "text-emerald-300" },
    { label: "Avg watch time", value: formatDuration(averageWatchTime), note: "Measured sessions only", icon: Clock3, color: "text-cyan-300" },
    { label: "Avg completion", value: averageCompletion === null ? "Not measured" : `${averageCompletion}%`, note: "Measured sessions only", icon: TrendingUp, color: "text-amber-300" },
    { label: "Completion rate", value: completionRate === null ? "Not measured" : `${completionRate}%`, note: "Sessions reaching 90%+", icon: TrendingUp, color: "text-emerald-300" },
  ];

  const tabs: Array<{ id: Section; label: string; icon: typeof BarChart3 }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "sessions", label: "Sessions", icon: Activity },
    { id: "viewers", label: "Viewers", icon: Users },
    { id: "videos", label: "Videos", icon: VideoIcon },
    { id: "engagement", label: "Engagement", icon: TrendingUp },
  ];

  return (
    <TrackUpPageShell>
      <TrackUpContent>
        <div className="space-y-6">
        <TrackUpSurface className="flex flex-col gap-4 bg-linear-to-br from-violet-500/12 via-white/[0.03] to-blue-500/8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-violet-200/70"><BarChart3 size={14} /> {scopeType === "all" ? "Organization intelligence" : "Workspace intelligence"}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Workspace-level views, identified viewers, sessions, activity, and measured playback. Open a video to inspect its isolated viewers, sessions, events, and coverage.</p>
        </div>
          <div className="flex flex-col gap-2 sm:flex-row">
          <label className="text-xs text-white/40">
            Video
            <select value={videoFilter} onChange={(event) => setVideoFilter(event.target.value)} className="mt-1 block min-w-44 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50">
              <option value="all">All videos</option>
              {videos.map((video) => <option key={video.id} value={video.id}>{video.title}</option>)}
            </select>
          </label>
          <div>
            <p className="text-xs text-white/40">Date range</p>
            <div className="mt-1 flex rounded-xl border border-white/10 bg-black/20 p-1">
              {(["7", "30", "all"] as const).map((range) => (
                <button key={range} onClick={() => setDateRange(range)} className={`rounded-lg px-3 py-2 text-xs transition ${dateRange === range ? "bg-violet-500/25 text-violet-100" : "text-white/45 hover:text-white"}`}>
                  {range === "all" ? "All time" : `${range}d`}
                </button>
              ))}
            </div>
          </div>
        </div>
        </TrackUpSurface>

      <nav className="flex flex-wrap gap-2 border-b border-white/8 pb-3" aria-label="Analytics sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSection(id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${section === id ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/5 hover:text-white"}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-7">
        {stats.map(({ label, value, note, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
            <Icon size={17} className={color} />
            <p className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-1 text-xs font-medium text-white/65">{label}</p>
            <p className="mt-1 text-[11px] text-white/30">{note}</p>
          </div>
        ))}
      </div>

      {filteredSessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
          <Activity size={32} className="mx-auto text-white/20" />
          <h2 className="mt-4 text-base font-medium text-white">No activity in this view</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">Share a TrackUp viewer link and have an authenticated ClickUp viewer start playback. Change the video or date filter if you expected older activity.</p>
        </div>
      ) : section === "sessions" ? (
        <ViewerAnalyticsPanel mode="sessions" spaceId={spaceId ?? undefined} organizationId={organizationId ?? undefined} videos={videos} sessions={filteredSessions} title="Session activity" description="A structured view of every persisted session, with real viewer identity, provider, timing, telemetry quality, event count, and a direct timeline action." />
      ) : section === "viewers" ? (
        <ViewerAnalyticsPanel mode="viewers" spaceId={spaceId ?? undefined} organizationId={organizationId ?? undefined} videos={videos} sessions={filteredSessions} title="Viewer activity" description="A viewer directory grouped by persisted identity, with real session counts, video coverage, measured watch time, completion, last seen, and links into the viewer/session details." />
      ) : section === "videos" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Top videos by views</h2><p className="mt-1 text-xs text-white/35">Session count from the selected range</p></div><Eye size={17} className="text-violet-300" /></div>
            <div className="mt-5 space-y-4">
              {topByViews.map((video) => <div key={video.video_id}><div className="flex items-center justify-between gap-3 text-sm"><Link href={scoped(`/analytics/videos/${video.video_id}`)} className="truncate text-white/80 transition hover:text-violet-200">{video.title}</Link><span className="shrink-0 font-medium text-white">{video.total_views}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-linear-to-r from-violet-500 to-blue-400" style={{ width: `${(video.total_views / maxViews) * 100}%` }} /></div><p className="mt-1 text-[11px] capitalize text-white/30">{providerLabel(video.source_type)}</p></div>)}
            </div>
          </div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Top videos by watch time</h2><p className="mt-1 text-xs text-white/35">Only sessions with measured playback</p></div><Clock3 size={17} className="text-emerald-300" /></div>
            {topByWatchTime.length === 0 ? <p className="mt-8 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No measurable watch time in this view.</p> : <div className="mt-5 space-y-4">{topByWatchTime.map((video) => <div key={video.video_id}><div className="flex items-center justify-between gap-3 text-sm"><Link href={scoped(`/analytics/videos/${video.video_id}`)} className="truncate text-white/80 transition hover:text-emerald-200">{video.title}</Link><span className="shrink-0 font-medium text-white">{formatDuration(video.measurable_watch_time_seconds)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-cyan-400" style={{ width: `${((video.measurable_watch_time_seconds ?? 0) / maxWatchTime) * 100}%` }} /></div><p className="mt-1 text-[11px] capitalize text-white/30">{providerLabel(video.source_type)}</p></div>)}</div>}
          </div>
        </div>
      ) : section === "engagement" ? (
        <ActivitySection activity={activity} recentActivity={recentActivity} measuredSessions={measurableSessions.length} totalSessions={filteredSessions.length} completionRate={completionRate} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
            <ActivityChart activity={activity} />
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Measurement health</h2><p className="mt-1 text-xs text-white/35">Scope of the selected activity</p></div><PlayCircle size={17} className="text-violet-300" /></div><div className="mt-6 space-y-4"><div className="flex items-center justify-between text-sm"><span className="text-white/55">Measured sessions</span><strong className="text-white">{measurableSessions.length}</strong></div><div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${filteredSessions.length ? (measurableSessions.length / filteredSessions.length) * 100 : 0}%` }} /></div><div className="flex items-center justify-between text-sm"><span className="text-white/55">Completion rate</span><strong className="text-white">{completionRate === null ? "Not measured" : `${completionRate}%`}</strong></div><p className="text-xs leading-5 text-white/35">Watch time and completion never treat unsupported providers as zero. Session-only providers remain visible with their actual lifecycle timestamps.</p></div></div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2"><TopVideosCard spaceId={spaceId} organizationId={organizationId} title="Top videos by views" videos={topByViews} value={(video) => `${video.total_views} views`} max={maxViews} color="violet" /><TopVideosCard spaceId={spaceId} organizationId={organizationId} title="Top videos by measured watch time" videos={topByWatchTime} value={(video) => formatDuration(video.measurable_watch_time_seconds)} max={maxWatchTime} color="emerald" /></div>
        </div>
      )}
        </div>
      </TrackUpContent>
    </TrackUpPageShell>
  );
}

function ActivityChart({ activity }: { activity: Array<{ date: string; views: number; sessions: number }> }) {
  return <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Views over time</h2><p className="mt-1 text-xs text-white/35">Started sessions grouped by day</p></div><Activity size={17} className="text-violet-300" /></div><div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activity}><defs><linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#ffffff14" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#ffffff55", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#ffffff55", fontSize: 10 }} tickLine={false} axisLine={false} width={28} /><Tooltip contentStyle={{ background: "#16121f", border: "1px solid #ffffff1c", borderRadius: 12, color: "white" }} labelStyle={{ color: "#ffffffaa" }} /><Area type="monotone" dataKey="views" stroke="#a78bfa" strokeWidth={2} fill="url(#viewsFill)" /></AreaChart></ResponsiveContainer></div></div>;
}

function TopVideosCard({ spaceId, organizationId, title, videos, value, max, color }: { spaceId: string | null; organizationId?: string | null; title: string; videos: Array<{ video_id: string; space_id?: string | null; title: string; source_type: Video["source_type"]; total_views: number; measurable_watch_time_seconds: number | null }>; value: (video: (typeof videos)[number]) => string; max: number; color: "violet" | "emerald" }) {
  const scoped = (path: string) => {
    const parameter = spaceId ? `space_id=${encodeURIComponent(spaceId)}` : organizationId ? `organization_id=${encodeURIComponent(organizationId)}` : "";
    return parameter ? `${path}?${parameter}` : path;
  };
  return <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><h2 className="text-base font-semibold text-white">{title}</h2><div className="mt-5 space-y-4">{videos.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">Not measured yet.</p> : videos.map((video) => { const amount = color === "violet" ? video.total_views : video.measurable_watch_time_seconds ?? 0; return <div key={video.video_id}><div className="flex items-center justify-between gap-3 text-sm"><Link href={scoped(`/analytics/videos/${video.video_id}`)} className="truncate text-white/80 transition hover:text-violet-200">{video.title}</Link><span className="shrink-0 text-white">{value(video)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full ${color === "violet" ? "bg-violet-400" : "bg-emerald-400"}`} style={{ width: `${(amount / max) * 100}%` }} /></div></div>; })}</div></div>;
}

function ActivitySection({ activity, recentActivity, measuredSessions, totalSessions, completionRate }: { activity: Array<{ date: string; views: number; sessions: number }>; recentActivity: ViewerSessionAnalytics[]; measuredSessions: number; totalSessions: number; completionRate: number | null }) {
  const measurementPercentage = totalSessions > 0 ? Math.round((measuredSessions / totalSessions) * 100) : 0;
  return <div className="space-y-6"><ActivityChart activity={activity} /><div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"><div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Recent activity</p><h2 className="mt-1 text-base font-semibold text-white">Latest viewer sessions</h2></div><Clock3 size={17} className="text-cyan-300" /></div>{recentActivity.length === 0 ? <p className="mt-6 text-sm text-white/35">No recent activity.</p> : <div className="mt-5 divide-y divide-white/7">{recentActivity.map((session) => <div key={session.session_id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{session.video_title}</p><p className="mt-1 truncate text-xs text-white/40">{session.viewer_name || session.viewer_email || "Legacy viewer"} · {formatDate(session.last_activity_at)}</p></div><div className="flex items-center gap-3 text-xs text-white/45"><span>{session.first_play_at ? "Played" : "Opened"}</span><span className="rounded-full border border-white/10 px-2 py-1 capitalize">{providerLabel(session.source_type)}</span></div></div>)}</div>}</div><div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Measurement health</p><h2 className="mt-1 text-base font-semibold text-white">Evidence quality</h2><div className="mt-6 space-y-5"><div><div className="flex items-center justify-between text-sm"><span className="text-white/55">Measured sessions</span><strong className="text-white">{measuredSessions} / {totalSessions}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${measurementPercentage}%` }} /></div></div><div className="flex items-center justify-between text-sm"><span className="text-white/55">90%+ completion rate</span><strong className="text-white">{completionRate === null ? "Not measured" : `${completionRate}%`}</strong></div><p className="text-xs leading-5 text-white/35">Provider limitations and missing transitions stay visible as unavailable; they are never treated as zero engagement.</p></div></div></div></div>;
}
