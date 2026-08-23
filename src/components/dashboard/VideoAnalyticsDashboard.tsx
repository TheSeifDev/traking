"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Layers3,
  PlayCircle,
  TrendingUp,
  Users,
  Video as VideoIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ViewerAnalyticsPanel from "@/src/components/dashboard/ViewerAnalyticsPanel";
import { HeatmapPanel } from "@/src/components/dashboard/AnalyticsDetail";
import type { Video, VideoAnalytics, ViewerSessionAnalytics } from "@/src/types/video";

interface VideoAnalyticsDashboardProps {
  video: Video;
  analytics: VideoAnalytics;
}

type Section = "overview" | "viewers" | "activity";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not measured";
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  return `${Math.floor(safe / 60)}m ${safe % 60}s`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function scopeLabel(scope: VideoAnalytics["playback_metrics_scope"]): string {
  if (scope === "youtube_iframe_api") return "YouTube IFrame API";
  if (scope === "direct_url_native_html5") return "Native HTML5";
  return "Session only";
}

function providerLabel(sourceType: Video["source_type"]): string {
  return sourceType.replace("_", " ");
}

function getYouTubeId(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const candidate = parsed.hostname.includes("youtu.be")
      ? parsed.pathname.split("/").filter(Boolean)[0]
      : parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).pop();
    return candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function measuredProgress(session: ViewerSessionAnalytics): number | null {
  if (session.last_position === null || session.last_duration === null || session.last_duration <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((session.last_position / session.last_duration) * 100)));
}

export default function VideoAnalyticsDashboard({ video, analytics }: VideoAnalyticsDashboardProps) {
  const [section, setSection] = useState<Section>("overview");
  const measuredSessions = analytics.viewer_sessions.filter((session) => session.has_playback_telemetry);
  const progressSessions = analytics.viewer_sessions.filter((session) => session.has_playback_telemetry && measuredProgress(session) !== null);
  const youtubeId = video.source_type === "youtube" ? getYouTubeId(video.source_url) : null;
  const latestProgress = progressSessions.length > 0 ? Math.max(...progressSessions.map((session) => measuredProgress(session) ?? 0)) : null;
  const chartData = useMemo(() => progressSessions.slice(0, 12).reverse().map((session, index) => ({
    session: `S${index + 1}`,
    progress: measuredProgress(session) ?? 0,
  })), [progressSessions]);

  const stats = [
    { label: "Total views", value: analytics.total_views.toLocaleString(), note: "Recorded sessions", icon: Eye, color: "text-violet-300" },
    { label: "Unique viewers", value: analytics.unique_viewers.toLocaleString(), note: "Profiles or legacy hashes", icon: Users, color: "text-blue-300" },
    { label: "Sessions", value: analytics.total_sessions.toLocaleString(), note: "One record per visit", icon: Layers3, color: "text-cyan-300" },
    { label: "Measured watch time", value: formatDuration(analytics.total_measurable_watch_time_seconds), note: "Native/API telemetry only", icon: Clock3, color: "text-emerald-300" },
    { label: "Avg watch time", value: formatDuration(analytics.avg_watch_time_seconds), note: "Measured sessions only", icon: Clock3, color: "text-cyan-300" },
    { label: "Avg % watched", value: analytics.avg_completion_percentage === null ? "Not measured" : `${analytics.avg_completion_percentage}%`, note: "Measured sessions only", icon: TrendingUp, color: "text-blue-300" },
    { label: "Completion rate", value: analytics.completion_rate === null ? "Not measured" : `${analytics.completion_rate}%`, note: "Sessions reaching 90%+", icon: CheckCircle2, color: "text-amber-300" },
    { label: "Last activity", value: formatDate(analytics.last_activity_at), note: "Latest stored session/event", icon: Activity, color: "text-violet-300" },
  ];

  const tabs: Array<{ id: Section; label: string; icon: typeof BarChart3 }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "viewers", label: "Viewers & sessions", icon: Users },
    { id: "activity", label: "Activity timeline", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-linear-to-br from-violet-500/12 via-white/[0.03] to-blue-500/8 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="hidden h-20 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:block" style={youtubeId ? { backgroundImage: `url(https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg)`, backgroundPosition: "center", backgroundSize: "cover" } : undefined} aria-label={youtubeId ? "YouTube video thumbnail" : "No preview available"}>
            {!youtubeId && <VideoIconPlaceholder />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40"><span className="rounded-full border border-white/10 px-2 py-1 capitalize">{providerLabel(video.source_type)}</span><span className="text-violet-200/70">{analytics.viewer_sessions.some((session) => session.has_playback_telemetry) ? `${scopeLabel(analytics.playback_metrics_scope)} telemetry recorded` : `${scopeLabel(analytics.playback_metrics_scope)} capability`}</span></div>
            <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight text-white">{video.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">{video.description || "Video-level performance and real viewer session telemetry."}</p>
            <Link href={`/analytics/videos/${video.id}`} className="mt-3 inline-flex text-xs font-medium text-violet-200 hover:text-violet-100">Open dedicated video analytics →</Link>
          </div>
        </div>
        <div className="shrink-0 rounded-2xl border border-white/10 bg-black/15 px-5 py-4 text-center"><p className="text-2xl font-semibold text-white">{video.duration ? formatDuration(video.duration) : "—"}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">Video duration</p></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><Icon size={17} className={color} /><p className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs font-medium text-white/65">{label}</p><p className="mt-1 text-[11px] text-white/30">{note}</p></div>)}
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-white/8 pb-3" aria-label="Video analytics sections">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${section === id ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/5 hover:text-white"}`}><Icon size={15} />{label}</button>)}
      </nav>

      {section === "viewers" ? <ViewerAnalyticsPanel sessions={analytics.viewer_sessions} title="Viewer and session details" description="Every row is a real session. New sessions may show the authenticated profile identity; legacy sessions remain hashed or anonymous. Playback fields are available only for native HTML5 or YouTube IFrame API telemetry." /> : section === "activity" ? <ActivityTimeline sessions={analytics.viewer_sessions} /> : <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-start justify-between"><div><h2 className="text-base font-semibold text-white">Measured playback progress</h2><p className="mt-1 text-xs leading-5 text-white/35">Latest reliable position divided by provider-reported duration per measured session.</p></div><PlayCircle size={18} className="text-emerald-300" /></div>{progressSessions.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-8 text-center"><p className="text-sm text-white/40">Not measured yet</p><p className="mt-2 text-xs leading-5 text-white/30">A viewer must start playback before TrackUp can store current position and duration.</p></div> : <><div className="mt-6 flex items-end gap-4"><p className="text-5xl font-semibold tracking-tight text-white">{latestProgress}%</p><p className="pb-1 text-xs text-white/40">furthest reliable position<br />across {progressSessions.length} session{progressSessions.length === 1 ? "" : "s"}</p></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-cyan-400" style={{ width: `${latestProgress}%` }} /></div><div className="mt-6 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}><CartesianGrid stroke="#ffffff14" vertical={false} /><XAxis dataKey="session" tick={{ fill: "#ffffff55", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "#ffffff55", fontSize: 10 }} tickLine={false} axisLine={false} width={38} /><Tooltip formatter={(value) => [`${value}%`, "Position reached"]} contentStyle={{ background: "#16121f", border: "1px solid #ffffff1c", borderRadius: 12, color: "white" }} /><Bar dataKey="progress" fill="#34d399" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></>}</div>
        <div className="space-y-6"><div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><h2 className="text-base font-semibold text-white">Measurement scope</h2><div className="mt-5 space-y-4"><div className="flex items-center justify-between text-sm"><span className="text-white/45">Provider</span><span className="capitalize text-white/80">{providerLabel(video.source_type)}</span></div><div className="flex items-center justify-between text-sm"><span className="text-white/45">Provider capability</span><span className="text-white/80">{scopeLabel(analytics.playback_metrics_scope)}</span></div><div className="flex items-center justify-between text-sm"><span className="text-white/45">Telemetry sessions</span><span className="text-white/80">{measuredSessions.length} / {analytics.total_sessions}</span></div><div className="flex items-center justify-between text-sm"><span className="text-white/45">Measured average</span><span className="text-white/80">{formatDuration(analytics.avg_watch_time_seconds)}</span></div></div></div><HeatmapPanel heatmap={analytics.heatmap} /></div>
      </div>}
    </div>
  );
}

function VideoIconPlaceholder() {
  return <div className="flex h-full items-center justify-center text-white/20"><VideoIcon size={22} /></div>;
}

function ActivityTimeline({ sessions }: { sessions: ViewerSessionAnalytics[] }) {
  const events = sessions.flatMap((session) => session.playback_events.map((event) => ({ ...event, video_title: session.video_title, session_id: session.session_id }))).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Stored playback activity</h2><p className="mt-1 text-xs leading-5 text-white/35">Actual events received from the supported player; click a session to inspect its stored timeline.</p></div><Activity size={18} className="text-violet-300" /></div>{events.length === 0 ? <p className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">No measurable playback events yet.</p> : <div className="mt-5 divide-y divide-white/7">{events.slice(0, 100).map((event) => <div key={event.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-white">{event.event_type}</p><p className="mt-1 text-xs text-white/40">{event.video_title} · session {event.session_id.slice(0, 8)}</p></div><div className="flex flex-wrap gap-3 text-xs text-white/45"><span>position {Math.round(event.position)}s</span>{event.from_position !== null && <span>from {Math.round(event.from_position)}s</span>}{event.duration !== null && <span>duration {Math.round(event.duration)}s</span>}<span>{formatDate(event.created_at)}</span></div></div>)}</div>}</section>;
}
