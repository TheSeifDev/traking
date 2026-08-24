"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, BarChart3, CalendarDays, CheckCircle2, ChevronRight, Clock3, Eye, Film, Gauge, Play, Search, ShieldAlert, Timer, Users } from "lucide-react";
import type { AnalyticsViewerSummary, PlaybackHeatmap, TelemetryState, ViewerAnalytics, ViewerSessionAnalytics, ViewerVideoAnalytics } from "@/src/types/video";
import { formatAnalyticsDate, formatAnalyticsDuration, formatAnalyticsPosition, telemetryClass, telemetryCopy } from "@/src/components/dashboard/AnalyticsDetail";
import { getProviderAdapter, getProviderLabel } from "@/src/lib/playback/providers";

type Tab = "overview" | "videos" | "sessions" | "timeline" | "heatmap" | "activity";
type SortMode = "last_watched" | "watch_time" | "completion" | "sessions";

const tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "videos", label: "Videos", icon: Film },
  { id: "sessions", label: "Sessions", icon: Timer },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "heatmap", label: "Playback heatmap", icon: BarChart3 },
  { id: "activity", label: "Activity", icon: Gauge },
];

function displayViewer(viewer: AnalyticsViewerSummary): string {
  return viewer.viewer_name?.trim() || viewer.viewer_email?.trim() || (viewer.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer");
}

function percent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "Not measured" : `${Math.round(value)}%`;
}

function providerThumb(video: ViewerVideoAnalytics): string | null {
  return getProviderAdapter(video.source_type).thumbnail_url(video.source_url ?? "");
}

function statusForVideo(video: ViewerVideoAnalytics): TelemetryState {
  return video.telemetry_state;
}

export default function ViewerAnalyticsDashboard({ data, scopeQuery, backHref, initialTab = "videos" }: { data: ViewerAnalytics; scopeQuery: string; backHref: string; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [videoSearch, setVideoSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatus, setSessionStatus] = useState<"all" | "measured" | "session_only" | "missing" | "completed" | "ended">("all");
  const [sortMode, setSortMode] = useState<SortMode>("last_watched");

  const filteredVideos = useMemo(() => {
    const query = videoSearch.trim().toLowerCase();
    return data.videos
      .filter((video) => !query || `${video.video_title} ${getProviderLabel(video.source_type)}`.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortMode === "watch_time") return (b.total_watch_time_seconds ?? -1) - (a.total_watch_time_seconds ?? -1);
        if (sortMode === "completion") return (b.best_completion_percentage ?? -1) - (a.best_completion_percentage ?? -1);
        if (sortMode === "sessions") return b.total_sessions - a.total_sessions;
        return new Date(b.last_watched_at ?? 0).getTime() - new Date(a.last_watched_at ?? 0).getTime();
      });
  }, [data.videos, sortMode, videoSearch]);

  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return data.sessions.filter((session) => {
      const searchable = `${session.video_title} ${getProviderLabel(session.source_type)} ${session.session_id}`.toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (sessionStatus === "measured" && session.telemetry_state !== "measured") return false;
      if (sessionStatus === "session_only" && session.telemetry_state !== "unsupported") return false;
      if (sessionStatus === "missing" && session.telemetry_state !== "missing") return false;
      if (sessionStatus === "completed" && (session.completion_percentage ?? -1) < 90) return false;
      if (sessionStatus === "ended" && !session.ended_at) return false;
      return true;
    });
  }, [data.sessions, sessionSearch, sessionStatus]);

  const viewerName = displayViewer(data.viewer);
  return (
    <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1320px] space-y-6">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link href={backHref} className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-white/65 transition hover:border-violet-300/35 hover:text-white" aria-label="Back to analytics"><ChevronRight size={17} className="rotate-180" /></Link>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-violet-300/70">Viewer analytics</p>
              <div className="mt-2 flex flex-wrap items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-indigo-700 text-sm font-semibold text-white">{initials(viewerName)}</div><h1 className="break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{viewerName}</h1><span className={`rounded-full border px-2.5 py-1 text-[10px] ${data.viewer.viewer_status === "identified" && data.viewer.viewer_is_active !== false ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/50"}`}>{data.viewer.viewer_status === "identified" ? (data.viewer.viewer_is_active === false ? "Inactive" : "Active") : "Legacy viewer"}</span></div>
              <p className="mt-2 text-sm text-white/45">{data.viewer.viewer_email ?? "No authenticated profile email"} · Viewer analytics and activity overview</p>
              <p className="mt-2 text-[10px] text-white/25">Viewer ID {data.viewer.viewer_id}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Link href={backHref} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"><Users size={14} />All video viewers</Link>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white/55"><CalendarDays size={14} />All persisted activity</span>
          </div>
        </header>

        <MetricCards data={data} />

        <nav className="flex min-w-0 gap-1 overflow-x-auto border-b border-white/8 pb-px" aria-label="Viewer analytics sections">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-medium transition ${tab === id ? "border-violet-400 text-violet-200" : "border-transparent text-white/45 hover:text-white/80"}`}><Icon size={14} />{label}</button>)}
        </nav>

        {tab === "overview" && <OverviewTab data={data} scopeQuery={scopeQuery} onVideos={() => setTab("videos")} />}
        {tab === "videos" && <VideosTab videos={filteredVideos} search={videoSearch} setSearch={setVideoSearch} sortMode={sortMode} setSortMode={setSortMode} scopeQuery={scopeQuery} />}
        {tab === "sessions" && <SessionsTab sessions={filteredSessions} search={sessionSearch} setSearch={setSessionSearch} status={sessionStatus} setStatus={setSessionStatus} scopeQuery={scopeQuery} />}
        {tab === "timeline" && <TimelineTab sessions={data.sessions} scopeQuery={scopeQuery} />}
        {tab === "heatmap" && <HeatmapTab videos={data.videos} />}
        {tab === "activity" && <ActivityTab sessions={data.sessions} />}
      </div>
    </div>
  );
}

function MetricCards({ data }: { data: ViewerAnalytics }) {
  const metrics = [
    { label: "Sessions", value: String(data.summary.total_sessions), note: "Real persisted visits", icon: Users, tone: "text-violet-300" },
    { label: "Videos watched", value: String(data.summary.videos_watched), note: "Unique videos", icon: Film, tone: "text-cyan-300" },
    { label: "Total watch time", value: formatAnalyticsDuration(data.summary.total_watch_time_seconds), note: "Measured sessions only", icon: Clock3, tone: "text-emerald-300" },
    { label: "Average completion", value: percent(data.summary.average_completion_percentage), note: "Across measured sessions", icon: CheckCircle2, tone: "text-fuchsia-300" },
    { label: "Last seen", value: data.summary.last_seen_at ? new Date(data.summary.last_seen_at).toLocaleDateString() : "Not recorded", note: data.summary.last_seen_at ? new Date(data.summary.last_seen_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "No activity", icon: Eye, tone: "text-violet-300" },
  ];
  return <section className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{metrics.map(({ label, value, note, icon: Icon, tone }) => <article key={label} className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.035] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.12)]"><Icon size={17} className={tone} /><p className="mt-4 break-words text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs font-medium text-white/65">{label}</p><p className="mt-1 break-words text-[11px] text-white/30">{note}</p></article>)}</section>;
}

function OverviewTab({ data, scopeQuery, onVideos }: { data: ViewerAnalytics; scopeQuery: string; onVideos: () => void }) {
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><SectionHeading eyebrow="Viewer profile" title="Identity and activity" body="A high-level view of the authenticated identity and the persisted activity available in this scope." /><div className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2"><Info label="First seen" value={formatAnalyticsDate(data.summary.first_seen_at)} /><Info label="Last seen" value={formatAnalyticsDate(data.summary.last_seen_at)} /><Info label="Device" value={data.summary.device_type ?? "Unknown"} /><Info label="Browser" value={data.summary.browser ?? "Unknown"} /><Info label="Operating system" value={data.summary.os ?? "Unknown"} /><Info label="Viewer status" value={data.viewer.viewer_status === "identified" ? "Authenticated profile" : "Legacy identity"} /></div></section>
    <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><SectionHeading eyebrow="Watched videos" title="Independent video performance" body="Each video is aggregated separately from every persisted session for this viewer." /><div className="mt-5 space-y-3">{data.videos.slice(0, 4).map((video) => <MiniVideo key={video.video_id} video={video} scopeQuery={scopeQuery} />)}{data.videos.length === 0 && <EmptyState title="No videos watched yet" body="No persisted video activity is available in this authorized scope." />} </div>{data.videos.length > 4 && <button type="button" onClick={onVideos} className="mt-5 text-xs font-medium text-violet-200 hover:text-violet-100">View all {data.videos.length} videos →</button>}</section>
  </div>;
}

function VideosTab({ videos, search, setSearch, sortMode, setSortMode, scopeQuery }: { videos: ViewerVideoAnalytics[]; search: string; setSearch: (value: string) => void; sortMode: SortMode; setSortMode: (value: SortMode) => void; scopeQuery: string }) {
  return <section className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03]"><div className="flex flex-col gap-4 border-b border-white/8 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Videos watched by this viewer" title="Independent video performance" body="All videos this viewer has watched, with progress and performance insights from persisted records." /><div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><label className="relative min-w-0 flex-1 lg:w-64"><Search size={14} className="absolute left-3 top-3 text-white/30" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos..." className="h-9 w-full rounded-xl border border-white/10 bg-black/15 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-violet-300/40" /></label><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="h-9 rounded-xl border border-white/10 bg-[#11112c] px-3 text-xs text-white/70 outline-none focus:border-violet-300/40"><option value="last_watched">Sort: Last watched</option><option value="watch_time">Sort: Watch time</option><option value="completion">Sort: Best completion</option><option value="sessions">Sort: Sessions</option></select></div></div><div className="hidden overflow-x-auto lg:block"><div className="min-w-[1060px]">{videos.map((video, index) => <VideoRow key={video.video_id} video={video} index={index} scopeQuery={scopeQuery} />)}</div></div><div className="space-y-3 p-3 lg:hidden">{videos.map((video, index) => <VideoCard key={video.video_id} video={video} index={index} scopeQuery={scopeQuery} />)}</div>{videos.length === 0 && <div className="p-10"><EmptyState title={search ? "No videos match your search" : "No videos watched yet"} body="Change the filter or wait until a persisted session is available for this viewer." /></div>}<div className="border-t border-white/8 px-5 py-3 text-xs text-white/35">Showing {videos.length} video{videos.length === 1 ? "" : "s"}</div></section>;
}

function VideoRow({ video, index, scopeQuery }: { video: ViewerVideoAnalytics; index: number; scopeQuery: string }) {
  const thumb = providerThumb(video);
  const progress = video.duration && video.unique_coverage_seconds !== null ? Math.min(100, Math.round((video.unique_coverage_seconds / video.duration) * 100)) : video.best_completion_percentage;
  return <article className="grid grid-cols-[40px_minmax(280px,1.5fr)_minmax(170px,1fr)_110px_130px_150px_185px] items-center gap-4 border-b border-white/7 px-4 py-4 last:border-b-0 hover:bg-white/[0.02]"><span className="text-xs text-white/35">{index + 1}</span><div className="flex min-w-0 items-center gap-3"><Thumb src={thumb} video={video} /><div className="min-w-0"><h3 className="break-words text-sm font-medium text-white">{video.video_title}</h3><span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${telemetryClass(statusForVideo(video))}`}>{getProviderLabel(video.source_type)} · {telemetryCopy(statusForVideo(video))}</span></div></div><div className="min-w-0"><div className="flex items-center justify-between gap-2 text-[11px]"><span className="text-white/45">Progress & completion</span><strong className="text-white/75">{percent(progress)}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full bg-linear-to-r from-violet-500 to-cyan-300" style={{ width: `${progress ?? 0}%` }} /></div><p className="mt-1 text-[10px] text-white/30">{formatAnalyticsDuration(video.unique_coverage_seconds)} / {formatAnalyticsDuration(video.duration)}</p></div><Stat label="Sessions" value={String(video.total_sessions)} note={`${video.measured_sessions} measured`} /><Stat label="Watch time" value={formatAnalyticsDuration(video.total_watch_time_seconds)} note="Measured only" /><Stat label="Last position" value={formatAnalyticsPosition(video.last_position)} note={`/ ${formatAnalyticsDuration(video.duration)}`} /><Link href={`/analytics/videos/${video.video_id}/viewers/${encodeURIComponent(video.sessions[0]?.viewer_profile_id ?? video.sessions[0]?.viewer_identifier ?? "")}${scopeQuery}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/30 px-3 py-2.5 text-xs font-medium text-violet-200 transition hover:bg-violet-400/10">View video analytics <ChevronRight size={14} /></Link></article>;
}

function VideoCard({ video, index, scopeQuery }: { video: ViewerVideoAnalytics; index: number; scopeQuery: string }) {
  const thumb = providerThumb(video);
  const progress = video.duration && video.unique_coverage_seconds !== null ? Math.min(100, Math.round((video.unique_coverage_seconds / video.duration) * 100)) : video.best_completion_percentage;
  const target = `/analytics/videos/${video.video_id}/viewers/${encodeURIComponent(video.sessions[0]?.viewer_profile_id ?? video.sessions[0]?.viewer_identifier ?? "")}${scopeQuery}`;
  return <article className="rounded-2xl border border-white/8 bg-black/10 p-4"><div className="flex items-start gap-3"><span className="pt-1 text-xs text-white/35">{index + 1}</span><Thumb src={thumb} video={video} /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-medium text-white">{video.video_title}</h3><span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${telemetryClass(statusForVideo(video))}`}>{getProviderLabel(video.source_type)} · {telemetryCopy(statusForVideo(video))}</span></div></div><div className="mt-4 flex items-center justify-between text-xs"><span className="text-white/45">Progress & completion</span><strong className="text-white/80">{percent(progress)}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full bg-linear-to-r from-violet-500 to-cyan-300" style={{ width: `${progress ?? 0}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 min-[420px]:grid-cols-4"><Stat label="Sessions" value={String(video.total_sessions)} note={`${video.measured_sessions} measured`} /><Stat label="Watch time" value={formatAnalyticsDuration(video.total_watch_time_seconds)} note="Measured only" /><Stat label="Last position" value={formatAnalyticsPosition(video.last_position)} note={`/ ${formatAnalyticsDuration(video.duration)}`} /><Stat label="Last watched" value={video.last_watched_at ? new Date(video.last_watched_at).toLocaleDateString() : "Not recorded"} note="Persisted activity" /></div><Link href={target} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300/30 px-3 py-2.5 text-xs font-medium text-violet-200 transition hover:bg-violet-400/10">View video analytics <ChevronRight size={14} /></Link></article>;
}

function SessionsTab({ sessions, search, setSearch, status, setStatus, scopeQuery }: { sessions: ViewerSessionAnalytics[]; search: string; setSearch: (value: string) => void; status: "all" | "measured" | "session_only" | "missing" | "completed" | "ended"; setStatus: (value: "all" | "measured" | "session_only" | "missing" | "completed" | "ended") => void; scopeQuery: string }) {
  return <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Sessions for this viewer" title="Every persisted viewing session" body="Open any session to inspect real event order, timestamps, positions, and coverage." /><div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><label className="relative min-w-0 flex-1 lg:w-72"><Search size={14} className="absolute left-3 top-3 text-white/30" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search video, provider, session..." className="h-9 w-full rounded-xl border border-white/10 bg-black/15 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-violet-300/40" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 rounded-xl border border-white/10 bg-[#11112c] px-3 text-xs text-white/70 outline-none focus:border-violet-300/40"><option value="all">All statuses</option><option value="measured">Measured</option><option value="session_only">Session only</option><option value="missing">No telemetry</option><option value="completed">Completed</option><option value="ended">Ended</option></select></div></div><div className="mt-5 space-y-3">{sessions.map((session) => <SessionCard key={session.session_id} session={session} scopeQuery={scopeQuery} />)}{sessions.length === 0 && <EmptyState title="No sessions match your filters" body="Try another search or status. TrackUp does not create placeholder sessions." />}</div><p className="mt-5 text-xs text-white/30">Showing {sessions.length} persisted session{sessions.length === 1 ? "" : "s"}</p></section>;
}

function SessionCard({ session, scopeQuery }: { session: ViewerSessionAnalytics; scopeQuery: string }) {
  const status = session.ended_at ? "Ended" : "Active";
  const href = `/analytics/videos/${session.video_id}/sessions/${session.session_id}${scopeQuery}`;
  return <article className="rounded-2xl border border-white/8 bg-black/10 p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"><Play size={15} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-white">Session {session.session_number}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] ${telemetryClass(session.telemetry_state ?? "missing")}`}>{telemetryCopy(session.telemetry_state ?? "missing")}</span><span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/45">{status}</span></div><p className="mt-1 break-words text-xs text-white/50">{session.video_title} · {getProviderLabel(session.source_type)}</p><p className="mt-1 break-all text-[10px] text-white/30">{formatAnalyticsDate(session.started_at)} · {session.session_id}</p></div></div><Link href={href} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-300/30 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-400/10">View session <ChevronRight size={14} /></Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"><Stat label="Duration" value={formatAnalyticsDuration(diffSeconds(session.started_at, session.ended_at ?? session.last_activity_at))} note="Visit time" /><Stat label="Watch time" value={formatAnalyticsDuration(session.watch_time_seconds)} note="Measured only" /><Stat label="Completion" value={percent(session.completion_percentage)} note="Provider-backed" /><Stat label="Last position" value={formatAnalyticsPosition(session.last_position)} note="Playhead" /><Stat label="Events" value={String(session.playback_events.length)} note="Persisted" /><Stat label="First play" value={session.first_play_at ? new Date(session.first_play_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not recorded"} note="Actual play event" /></div></article>;
}

function TimelineTab({ sessions, scopeQuery }: { sessions: ViewerSessionAnalytics[]; scopeQuery: string }) {
  const events = sessions.flatMap((session) => session.playback_events.map((event) => ({ session, event }))).sort((a, b) => new Date(a.event.occurred_at ?? a.event.created_at).getTime() - new Date(b.event.occurred_at ?? b.event.created_at).getTime());
  return <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><SectionHeading eyebrow="Cross-video timeline" title="What this viewer did over time" body="Chronological activity assembled only from persisted sessions and playback events." /><div className="mt-6 space-y-3">{events.length === 0 && <EmptyState title="No persisted activity" body="There are no playback events available for this viewer in the selected scope." />}{events.map(({ session, event }) => <div key={`${session.session_id}-${event.id}`} className="flex gap-3 rounded-2xl border border-white/7 bg-black/10 p-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-300" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-white">{eventLabel(event.event_type)}</p><time className="text-[10px] text-white/35">{formatAnalyticsDate(event.occurred_at ?? event.created_at)}</time></div><p className="mt-1 break-words text-[11px] text-white/45">{session.video_title} · {formatAnalyticsPosition(event.position)}{event.from_position !== null ? ` · from ${formatAnalyticsPosition(event.from_position)}` : ""}</p><Link href={`/analytics/videos/${session.video_id}/sessions/${session.session_id}${scopeQuery}`} className="mt-2 inline-flex text-[10px] text-violet-200 hover:text-violet-100">View session →</Link></div></div>)}</div></section>;
}

function HeatmapTab({ videos }: { videos: ViewerVideoAnalytics[] }) {
  return <section className="space-y-4"><SectionHeading eyebrow="Playback heatmap" title="Watched coverage by video" body="Coverage is reconstructed from ordered playback transitions. Seek gaps and unsupported providers remain unavailable." />{videos.map((video) => <CoverageCard key={video.video_id} video={video} />)}{videos.length === 0 && <EmptyState title="No watched coverage" body="No persisted videos are available for coverage reconstruction." />}</section>;
}

function CoverageCard({ video }: { video: ViewerVideoAnalytics }) {
  const heatmap = video.heatmap;
  return <article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold text-white">{video.video_title}</p><p className="mt-1 text-xs text-white/40">{getProviderLabel(video.source_type)} · {telemetryCopy(video.telemetry_state)}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] ${heatmap.availability === "measured" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/45"}`}>{heatmapTitle(heatmap)}</span></div>{heatmap.available ? <><div className="mt-6 flex h-14 min-w-0 items-end gap-0.5 overflow-hidden rounded-xl border border-white/7 bg-black/15 p-2">{heatmap.buckets.map((bucket) => <span key={`${bucket.start}-${bucket.end}`} title={`${Math.round(bucket.start)}–${Math.round(bucket.end)}s · ${bucket.coverage_percentage}%`} className="min-w-[2px] flex-1 rounded-sm bg-linear-to-t from-violet-500 to-cyan-300" style={{ height: `${Math.max(8, bucket.coverage_percentage)}%`, opacity: 0.3 + bucket.coverage_percentage / 140 }} />)}</div><div className="mt-3 flex justify-between text-[10px] text-white/30"><span>0:00</span><span>{formatAnalyticsDuration(heatmap.duration_seconds)}</span></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-white/45"><span>Watched {formatAnalyticsDuration(video.unique_coverage_seconds)}</span><span>{heatmap.ranges.length} unique range{heatmap.ranges.length === 1 ? "" : "s"}</span><span>Bucket {heatmap.bucket_size_seconds}s</span></div></> : <div className="mt-5 flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-white/10 px-5 text-center text-xs text-white/35">{heatmapBody(heatmap)}</div>}</article>;
}

function ActivityTab({ sessions }: { sessions: ViewerSessionAnalytics[] }) {
  const counts = sessions.flatMap((session) => session.playback_events).reduce<Record<string, number>>((result, event) => { result[event.event_type] = (result[event.event_type] ?? 0) + 1; return result; }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><SectionHeading eyebrow="Activity" title="Playback behavior summary" body="Event counts are calculated from the persisted event records for this viewer." /><div className="mt-6 grid grid-cols-2 gap-3 min-[500px]:grid-cols-3 lg:grid-cols-5">{rows.map(([event, count]) => <article key={event} className="rounded-2xl border border-white/7 bg-black/10 p-4"><p className="break-words text-xs text-white/45">{eventLabel(event)}</p><p className="mt-2 text-xl font-semibold text-white">{count}</p><p className="mt-1 text-[10px] text-white/25">persisted events</p></article>)}</div>{rows.length === 0 && <div className="mt-6"><EmptyState title="No playback events" body="Session-only or unopened records do not provide playback behavior to summarize." /></div>}</section>;
}

function MiniVideo({ video, scopeQuery }: { video: ViewerVideoAnalytics; scopeQuery: string }) { const thumb = providerThumb(video); return <Link href={`/analytics/videos/${video.video_id}/viewers/${encodeURIComponent(video.sessions[0]?.viewer_profile_id ?? video.sessions[0]?.viewer_identifier ?? "")}${scopeQuery}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/7 bg-black/10 p-3 transition hover:border-violet-300/30"><Thumb src={thumb} video={video} /><div className="min-w-0 flex-1"><p className="break-words text-xs font-medium text-white">{video.video_title}</p><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/35"><span>{video.total_sessions} session{video.total_sessions === 1 ? "" : "s"}</span><span>{formatAnalyticsDuration(video.total_watch_time_seconds)}</span><span>{percent(video.best_completion_percentage)}</span></div></div><ChevronRight size={15} className="shrink-0 text-white/25" /></Link>; }

function Thumb({ src, video }: { src: string | null; video: ViewerVideoAnalytics }) { return <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-linear-to-br from-violet-950 to-slate-900 text-[9px] text-white/45" style={src ? { backgroundImage: `linear-gradient(90deg, rgba(6,6,24,.1), rgba(6,6,24,.45)), url(${JSON.stringify(src).slice(1, -1)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!src && <span>{getProviderLabel(video.source_type)}</span>}</div>; }

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) { return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">{eyebrow}</p><h2 className="mt-2 break-words text-lg font-semibold text-white">{title}</h2><p className="mt-1 max-w-2xl break-words text-xs leading-5 text-white/40">{body}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-white/7 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-white/30">{label}</p><p className="mt-1 break-words text-sm text-white/75">{value}</p></div>; }
function Stat({ label, value, note }: { label: string; value: string; note: string }) { return <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p><p className="mt-1 break-words text-sm font-medium text-white/80">{value}</p><p className="mt-1 break-words text-[10px] text-white/25">{note}</p></div>; }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-5 py-7 text-center"><ShieldAlert size={19} className="text-white/20" /><p className="mt-3 text-sm text-white/50">{title}</p><p className="mt-1 max-w-md text-xs leading-5 text-white/30">{body}</p></div>; }
function initials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?"; }
function diffSeconds(start: string, end: string): number { return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)); }
function eventLabel(eventType: string): string { return eventType.replaceAll("_", " ").replace(/\b\w/g, (value) => value.toUpperCase()); }
function heatmapTitle(heatmap: PlaybackHeatmap): string { if (heatmap.availability === "measured") return "Measured coverage"; if (heatmap.availability === "not_available_from_provider") return "Provider unsupported"; if (heatmap.availability === "insufficient_data") return "Insufficient data"; return "No telemetry"; }
function heatmapBody(heatmap: PlaybackHeatmap): string { if (heatmap.availability === "not_available_from_provider") return "This provider exposes session lifecycle only; TrackUp does not invent playback ranges."; if (heatmap.availability === "insufficient_data") return "Events exist, but their ordering or transitions are insufficient for a defensible watched range."; return "No reliable position data is available for a heatmap."; }
