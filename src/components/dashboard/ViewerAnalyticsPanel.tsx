"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Clock3, Eye, Filter, PlayCircle, Search, Users, Video as VideoIcon } from "lucide-react";
import type { PlaybackMetricsScope, Video, ViewerSessionAnalytics } from "@/src/types/video";
import { getProviderAdapter, getProviderLabel } from "@/src/lib/playback/providers";

interface ViewerAnalyticsPanelProps {
  sessions: ViewerSessionAnalytics[];
  videos?: Video[];
  title?: string;
  description?: string;
  spaceId?: string;
  organizationId?: string;
  mode?: "sessions" | "viewers";
}

type StatusFilter = "all" | "measured" | "missing" | "unsupported";

type ViewerRow = {
  session: ViewerSessionAnalytics;
  sessions: number;
  videos: Set<string>;
  watchTime: number | null;
  completions: number[];
  lastSeen: string;
  measured: number;
};

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function shortDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "Not measured";
  const safeSeconds = Math.max(0, Math.round(seconds));
  return safeSeconds < 60 ? `${safeSeconds}s` : `${Math.floor(safeSeconds / 60)}m ${safeSeconds % 60}s`;
}

function formatPosition(seconds: number | null): string {
  return seconds === null || !Number.isFinite(seconds) ? "Unavailable" : formatDuration(seconds);
}

function viewerLabel(session: ViewerSessionAnalytics): string {
  if (session.viewer_name?.trim()) return session.viewer_name.trim();
  if (session.viewer_email?.trim()) return session.viewer_email.trim();
  return session.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer";
}

function viewerEmail(session: ViewerSessionAnalytics): string {
  return session.viewer_email ?? (session.viewer_status === "identified" ? "Email unavailable" : "Legacy viewer");
}

function initials(session: ViewerSessionAnalytics): string {
  const value = viewerLabel(session).trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}` : value.slice(0, 2)).toUpperCase();
}

function scopeLabel(scope: PlaybackMetricsScope): string {
  if (scope === "direct_url_native_html5") return "Native HTML5";
  if (scope === "youtube_iframe_api") return "YouTube API";
  if (scope === "vimeo_player_sdk") return "Vimeo SDK";
  return "Session only";
}

function statusLabel(session: ViewerSessionAnalytics): string {
  if (session.telemetry_state === "measured" || session.has_playback_telemetry) return "Measured";
  if (session.telemetry_state === "unsupported" || session.playback_metrics_scope === "session_only") return "Session only";
  if (session.playback_events.length > 0) return "Insufficient data";
  return "No telemetry";
}

function statusClass(session: ViewerSessionAnalytics): string {
  if (session.telemetry_state === "measured" || session.has_playback_telemetry) return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  if (session.telemetry_state === "unsupported" || session.playback_metrics_scope === "session_only") return "border-white/10 bg-white/[0.04] text-white/55";
  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}

function sessionDuration(session: ViewerSessionAnalytics): number | null {
  const end = session.ended_at ?? session.last_activity_at;
  const value = (new Date(end).getTime() - new Date(session.started_at).getTime()) / 1000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export default function ViewerAnalyticsPanel({
  sessions,
  videos = [],
  title = "Viewer and session activity",
  description = "Each row is a real watch session recorded by TrackUp.",
  spaceId,
  organizationId,
  mode = "sessions",
}: ViewerAnalyticsPanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [viewerPage, setViewerPage] = useState(1);
  const pageSize = 8;
  const videoById = useMemo(() => new Map(videos.map((video) => [video.id, video])), [videos]);

  const scopedForSession = (path: string, session?: ViewerSessionAnalytics) => {
    const parameter = organizationId
      ? `organization_id=${encodeURIComponent(organizationId)}`
      : session?.space_id
        ? `space_id=${encodeURIComponent(session.space_id)}`
        : spaceId
          ? `space_id=${encodeURIComponent(spaceId)}`
          : "";
    return parameter ? `${path}?${parameter}` : path;
  };

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sessions.filter((session) => {
      const statusMatches = statusFilter === "all"
        || (statusFilter === "measured" && (session.telemetry_state === "measured" || session.has_playback_telemetry))
        || (statusFilter === "unsupported" && (session.telemetry_state === "unsupported" || session.playback_metrics_scope === "session_only"))
        || (statusFilter === "missing" && session.telemetry_state !== "measured" && session.telemetry_state !== "unsupported" && session.playback_metrics_scope !== "session_only");
      if (!statusMatches) return false;
      if (!normalized) return true;
      return [session.viewer_identifier ?? "", session.viewer_profile_id ?? "", session.viewer_name ?? "", session.viewer_email ?? "", session.session_id, session.video_title, session.source_type].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [query, sessions, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageSessions = filteredSessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const viewerRows = useMemo(() => {
    const rows = new Map<string, ViewerRow>();
    for (const session of filteredSessions) {
      const key = session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`;
      const current = rows.get(key) ?? { session, sessions: 0, videos: new Set<string>(), watchTime: null, completions: [], lastSeen: session.last_activity_at, measured: 0 };
      current.sessions += 1;
      current.videos.add(session.video_id);
      if (session.watch_time_seconds !== null && session.has_playback_telemetry) {
        current.watchTime = (current.watchTime ?? 0) + session.watch_time_seconds;
        current.measured += 1;
      }
      if (session.completion_percentage !== null && session.has_playback_telemetry) current.completions.push(session.completion_percentage);
      if (session.last_activity_at > current.lastSeen) current.lastSeen = session.last_activity_at;
      rows.set(key, current);
    }
    return [...rows.values()].sort((a, b) => b.sessions - a.sessions || b.lastSeen.localeCompare(a.lastSeen));
  }, [filteredSessions]);

  const viewerPageCount = Math.max(1, Math.ceil(viewerRows.length / pageSize));
  const currentViewerPage = Math.min(viewerPage, viewerPageCount);
  const pageViewerRows = viewerRows.slice((currentViewerPage - 1) * pageSize, currentViewerPage * pageSize);

  const providerRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of filteredSessions) counts.set(session.source_type, (counts.get(session.source_type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredSessions]);

  const measuredSessions = filteredSessions.filter((session) => session.has_playback_telemetry);
  const measuredWatchTime = measuredSessions.length > 0 ? measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0) : null;
  const completionValues = measuredSessions.map((session) => session.completion_percentage).filter((value): value is number => value !== null);
  const averageCompletion = completionValues.length > 0 ? Math.round(completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length) : null;
  const uniqueViewers = new Set(filteredSessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`)).size;
  const maxViewerSessions = Math.max(1, ...viewerRows.map((row) => row.sessions));
  const maxProviderSessions = Math.max(1, ...providerRows.map(([, count]) => count));

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/65"><Users size={14} />Viewer intelligence</div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/40">{description}</p></div>
        <div className="flex items-center gap-2 text-xs text-white/35"><Activity size={14} />{filteredSessions.length} matching sessions</div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Unique viewers" value={String(uniqueViewers)} note="Profile-backed or one-way identity" icon={Users} />
        <Metric label="Sessions" value={String(filteredSessions.length)} note="Real persisted visits" icon={Eye} />
        <Metric label="Measured watch time" value={formatDuration(measuredWatchTime)} note="Reliable playback evidence only" icon={Clock3} />
        <Metric label="Avg completion" value={averageCompletion === null ? "Not measured" : `${averageCompletion}%`} note="Measured sessions only" icon={PlayCircle} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search viewers, email, session, video, or provider" className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-300/40" aria-label="Filter viewer and session analytics" /></div>
        <label className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45"><Filter size={14} /><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="bg-transparent text-sm text-white outline-none"><option value="all">All sessions</option><option value="measured">Measured</option><option value="missing">No telemetry</option><option value="unsupported">Session only</option></select></label>
      </div>

      {filteredSessions.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><VideoIcon size={28} className="mx-auto text-white/15" /><p className="mt-3 text-sm text-white/45">{sessions.length === 0 ? "No viewer sessions recorded yet." : "No sessions match these filters."}</p><p className="mt-1 text-xs text-white/30">Only persisted session and playback records appear here. Unsupported telemetry is never inferred.</p></div> : mode === "viewers" ? <ViewerDirectory rows={pageViewerRows} totalRows={viewerRows.length} currentPage={currentViewerPage} pageCount={viewerPageCount} pageSize={pageSize} onPrevious={() => setViewerPage((value) => Math.max(1, value - 1))} onNext={() => setViewerPage((value) => Math.min(viewerPageCount, value + 1))} scopedForSession={scopedForSession} /> : <>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]">
          <article className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Top viewers</p><h3 className="mt-1 text-sm font-semibold text-white">Who is watching</h3></div><Users size={16} className="text-violet-300" /></div><div className="mt-4 space-y-3">{viewerRows.slice(0, 5).map((row) => <div key={row.session.viewer_profile_id ?? row.session.viewer_identifier ?? row.session.session_id} className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400/12 text-xs font-semibold text-violet-100">{initials(row.session)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm text-white/80">{viewerLabel(row.session)}</p><span className="shrink-0 text-xs text-white/45">{row.sessions} session{row.sessions === 1 ? "" : "s"}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-violet-400/80" style={{ width: `${(row.sessions / maxViewerSessions) * 100}%` }} /></div><p className="mt-1 truncate text-[11px] text-white/30">{row.videos.size} video{row.videos.size === 1 ? "" : "s"} · last seen {shortDate(row.lastSeen)} · {row.measured > 0 ? formatDuration(row.watchTime) : "Not measured"} · {row.completions.length > 0 ? `${Math.round(row.completions.reduce((sum, value) => sum + value, 0) / row.completions.length)}% completion` : "Not measured"}</p></div></div>)}</div></article>
          <article className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Session type distribution</p><h3 className="mt-1 text-sm font-semibold text-white">Provider breakdown</h3></div><Activity size={16} className="text-cyan-300" /></div><div className="mt-4 space-y-3">{providerRows.map(([provider, count]) => <div key={provider}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate capitalize text-white/65">{getProviderLabel(provider as Video["source_type"])}</span><span className="text-white/45">{count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-cyan-400/75" style={{ width: `${(count / maxProviderSessions) * 100}%` }} /></div><p className="mt-1 text-[10px] text-white/30">{scopeLabel(sessions.find((session) => session.source_type === provider)?.playback_metrics_scope ?? "session_only")}</p></div>)}</div></article>
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] md:block"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="border-b border-white/8 bg-white/[0.025] text-[10px] uppercase tracking-[0.13em] text-white/30"><tr><th className="px-4 py-3 font-medium">Viewer / session</th><th className="px-4 py-3 font-medium">Video</th><th className="px-4 py-3 font-medium">Started</th><th className="px-4 py-3 font-medium">Watch / duration</th><th className="px-4 py-3 font-medium">Completion</th><th className="px-4 py-3 font-medium">Quality</th><th className="px-4 py-3 font-medium">Action</th></tr></thead><tbody className="divide-y divide-white/7">{pageSessions.map((session) => <SessionTableRow key={session.session_id} session={session} video={videoById.get(session.video_id)} href={scopedForSession(`/analytics/videos/${session.video_id}/sessions/${session.session_id}`, session)} viewerHref={session.viewer_profile_id ? scopedForSession(`/analytics/viewers/${encodeURIComponent(session.viewer_profile_id)}`, session) : null} />)}</tbody></table></div></div>

        <div className="space-y-3 md:hidden">{pageSessions.map((session) => <SessionCard key={session.session_id} session={session} video={videoById.get(session.video_id)} href={scopedForSession(`/analytics/videos/${session.video_id}/sessions/${session.session_id}`, session)} viewerHref={session.viewer_profile_id ? scopedForSession(`/analytics/viewers/${encodeURIComponent(session.viewer_profile_id)}`, session) : null} />)}</div>

        <div className="flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-white/35">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredSessions.length)} of {filteredSessions.length} sessions</p><div className="flex items-center gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Previous</button><span className="min-w-16 text-center text-xs text-white/45">Page {currentPage} / {pageCount}</span><button onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Next</button></div></div>
      </>}
    </section>
  );
}

function ViewerDirectory({ rows, totalRows, currentPage, pageCount, pageSize, onPrevious, onNext, scopedForSession }: { rows: ViewerRow[]; totalRows: number; currentPage: number; pageCount: number; pageSize: number; onPrevious: () => void; onNext: () => void; scopedForSession: (path: string, session?: ViewerSessionAnalytics) => string }) {
  return <div className="space-y-4">
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Viewer directory</p><h3 className="mt-1 text-sm font-semibold text-white">People and identities</h3></div><Users size={16} className="text-violet-300" /></div>
      <p className="mt-2 text-xs leading-5 text-white/35">One row per real viewer identity in the selected scope. Session count, videos, watch time, completion, and last seen are aggregated only from persisted sessions.</p>
    </div>
    <div className="hidden overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] md:block"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead className="border-b border-white/8 bg-white/[0.025] text-[10px] uppercase tracking-[0.13em] text-white/30"><tr><th className="px-4 py-3 font-medium">Viewer</th><th className="px-4 py-3 font-medium">Sessions</th><th className="px-4 py-3 font-medium">Videos</th><th className="px-4 py-3 font-medium">Watch time</th><th className="px-4 py-3 font-medium">Completion</th><th className="px-4 py-3 font-medium">Last seen</th><th className="px-4 py-3 font-medium">Action</th></tr></thead><tbody className="divide-y divide-white/7">{rows.map((row) => { const profileHref = row.session.viewer_profile_id ? scopedForSession(`/analytics/viewers/${encodeURIComponent(row.session.viewer_profile_id)}`, row.session) : null; const sessionHref = scopedForSession(`/analytics/videos/${row.session.video_id}/sessions/${row.session.session_id}`, row.session); const completion = row.completions.length > 0 ? `${Math.round(row.completions.reduce((sum, value) => sum + value, 0) / row.completions.length)}%` : "Not measured"; return <tr key={row.session.viewer_profile_id ?? row.session.viewer_identifier ?? row.session.session_id} className="transition hover:bg-white/[0.025]"><td className="px-4 py-3"><div className="flex min-w-[230px] items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400/12 text-xs font-semibold text-violet-100">{initials(row.session)}</div><div className="min-w-0"><p className="truncate text-sm text-white/80">{viewerLabel(row.session)}</p><p className="truncate text-[11px] text-white/35">{viewerEmail(row.session)}</p></div></div></td><td className="px-4 py-3 text-sm text-white/70">{row.sessions}</td><td className="px-4 py-3 text-sm text-white/70">{row.videos.size}</td><td className="px-4 py-3 text-sm text-white/70">{row.measured > 0 ? formatDuration(row.watchTime) : "Not measured"}</td><td className="px-4 py-3 text-sm text-white/70">{completion}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{formatDate(row.lastSeen)}</td><td className="px-4 py-3"><div className="flex flex-col items-start gap-1.5">{profileHref && <Link href={profileHref} className="whitespace-nowrap text-xs font-medium text-violet-200 hover:text-violet-100">View viewer →</Link>}<Link href={sessionHref} className="whitespace-nowrap text-[10px] text-white/40 hover:text-white">Latest session</Link></div></td></tr>; })}</tbody></table></div></div>
    <div className="space-y-3 md:hidden">{rows.map((row) => { const profileHref = row.session.viewer_profile_id ? scopedForSession(`/analytics/viewers/${encodeURIComponent(row.session.viewer_profile_id)}`, row.session) : null; const sessionHref = scopedForSession(`/analytics/videos/${row.session.video_id}/sessions/${row.session.session_id}`, row.session); const completion = row.completions.length > 0 ? `${Math.round(row.completions.reduce((sum, value) => sum + value, 0) / row.completions.length)}%` : "Not measured"; return <article key={row.session.viewer_profile_id ?? row.session.viewer_identifier ?? row.session.session_id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400/12 text-xs font-semibold text-violet-100">{initials(row.session)}</div><div className="min-w-0"><p className="truncate text-sm font-medium text-white/85">{viewerLabel(row.session)}</p><p className="truncate text-xs text-white/35">{viewerEmail(row.session)}</p><p className="mt-2 text-[10px] text-white/30">Last seen {formatDate(row.lastSeen)}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Detail label="Sessions" value={String(row.sessions)} /><Detail label="Videos" value={String(row.videos.size)} /><Detail label="Watch time" value={row.measured > 0 ? formatDuration(row.watchTime) : "Not measured"} /><Detail label="Completion" value={completion} /></div><div className="mt-4 flex flex-wrap gap-3 border-t border-white/7 pt-3">{profileHref && <Link href={profileHref} className="text-xs font-medium text-violet-200 hover:text-violet-100">View viewer →</Link>}<Link href={sessionHref} className="text-xs text-white/45 hover:text-white">Latest session</Link></div></article>; })}</div>
    <div className="flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-white/35">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRows)} of {totalRows} viewers</p><div className="flex items-center gap-2"><button onClick={onPrevious} disabled={currentPage === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Previous</button><span className="min-w-16 text-center text-xs text-white/45">Page {currentPage} / {pageCount}</span><button onClick={onNext} disabled={currentPage === pageCount} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Next</button></div></div>
  </div>;
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Users }) {
  return <article className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.035] p-4"><Icon size={16} className="text-violet-300" /><p className="mt-3 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">{label}</p><p className="mt-1 break-words text-xl font-semibold text-white">{value}</p><p className="mt-1 text-[11px] leading-4 text-white/30">{note}</p></article>;
}

function SessionTableRow({ session, video, href, viewerHref }: { session: ViewerSessionAnalytics; video?: Video; href: string; viewerHref: string | null }) {
  const thumbnail = video?.source_url ? getProviderAdapter(video.source_type).thumbnail_url(video.source_url) : null;
  return <tr className="align-middle transition hover:bg-white/[0.025]"><td className="px-4 py-3"><div className="flex min-w-[210px] items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-400/12 text-[10px] font-semibold text-violet-100">{initials(session)}</div><div className="min-w-0"><p className="max-w-[180px] truncate text-sm text-white/80">{viewerLabel(session)}</p><p className="max-w-[180px] truncate text-[11px] text-white/35">{viewerEmail(session)}</p><p className="text-[10px] text-white/25">#{session.session_number} · {session.session_id.slice(0, 8)}</p></div></div></td><td className="px-4 py-3"><div className="flex w-[210px] items-center gap-2">{thumbnail ? <span aria-hidden="true" className="h-8 w-12 shrink-0 rounded-md bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${thumbnail}")` }} /> : <div className="flex h-8 w-12 items-center justify-center rounded-md bg-white/[0.05]"><VideoIcon size={13} className="text-white/25" /></div>}<div className="min-w-0"><p className="truncate text-xs text-white/70">{session.video_title}</p><p className="mt-0.5 text-[10px] capitalize text-white/30">{getProviderLabel(session.source_type)}</p></div></div></td><td className="whitespace-nowrap px-4 py-3 text-xs text-white/55"><p>{formatDate(session.started_at)}</p><p className="mt-1 text-[10px] text-white/30">Last {formatDate(session.last_activity_at)}</p></td><td className="whitespace-nowrap px-4 py-3 text-xs text-white/60"><p>{formatDuration(session.watch_time_seconds)}</p><p className="mt-1 text-[10px] text-white/30">Visit {formatDuration(sessionDuration(session))}</p></td><td className="px-4 py-3 text-xs text-white/60">{session.completion_percentage === null ? "Not measured" : `${Math.round(session.completion_percentage)}%`}<p className="mt-1 text-[10px] text-white/30">Last {formatPosition(session.last_position)}</p></td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] ${statusClass(session)}`}>{statusLabel(session)}</span><p className="mt-1 text-[10px] text-white/30">{session.playback_events.length} events</p></td><td className="px-4 py-3"><div className="flex flex-col items-start gap-1.5"><Link href={href} className="whitespace-nowrap text-xs font-medium text-violet-200 hover:text-violet-100">View timeline →</Link>{viewerHref && <Link href={viewerHref} className="whitespace-nowrap text-[10px] text-white/40 hover:text-white">View viewer</Link>}</div></td></tr>;
}

function SessionCard({ session, video, href, viewerHref }: { session: ViewerSessionAnalytics; video?: Video; href: string; viewerHref: string | null }) {
  const thumbnail = video?.source_url ? getProviderAdapter(video.source_type).thumbnail_url(video.source_url) : null;
  return <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400/12 text-[10px] font-semibold text-violet-100">{initials(session)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-white/85">{viewerLabel(session)}</p><p className="truncate text-xs text-white/35">{viewerEmail(session)}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(session)}`}>{statusLabel(session)}</span></div><p className="mt-3 text-[10px] text-white/25">Session {session.session_id.slice(0, 12)} · #{session.session_number} · {formatDate(session.started_at)}</p></div></div><div className="mt-4 flex items-center gap-3 rounded-xl border border-white/7 bg-black/10 p-2.5">{thumbnail ? <span aria-hidden="true" className="h-10 w-16 shrink-0 rounded-lg bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${thumbnail}")` }} /> : <div className="flex h-10 w-16 items-center justify-center rounded-lg bg-white/[0.05]"><VideoIcon size={14} className="text-white/25" /></div>}<div className="min-w-0"><p className="truncate text-xs font-medium text-white/75">{session.video_title}</p><p className="mt-1 text-[10px] capitalize text-white/35">{getProviderLabel(session.source_type)} · {scopeLabel(session.playback_metrics_scope)}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Detail label="Watch time" value={formatDuration(session.watch_time_seconds)} /><Detail label="Visit duration" value={formatDuration(sessionDuration(session))} /><Detail label="Completion" value={session.completion_percentage === null ? "Not measured" : `${Math.round(session.completion_percentage)}%`} /><Detail label="Events" value={String(session.playback_events.length)} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/7 pt-3"><span className="text-[11px] text-white/35">Last position: <strong className="font-medium text-white/60">{formatPosition(session.last_position)}</strong></span><div className="flex gap-3"><Link href={href} className="text-xs font-medium text-violet-200 hover:text-violet-100">View timeline →</Link>{viewerHref && <Link href={viewerHref} className="text-xs text-white/45 hover:text-white">Viewer</Link>}</div></div></article>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/7 bg-black/10 p-2.5"><p className="truncate text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p><p className="mt-1 break-words text-xs text-white/75">{value}</p></div>;
}
