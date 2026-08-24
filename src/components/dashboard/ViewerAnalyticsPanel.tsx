"use client";

import Link from "next/link";
import { Activity, Clock3, Eye, PlayCircle, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlaybackMetricsScope, ViewerSessionAnalytics } from "@/src/types/video";
import GroupedSessionTimeline from "@/src/components/analytics/GroupedSessionTimeline";

interface ViewerAnalyticsPanelProps {
  sessions: ViewerSessionAnalytics[];
  title?: string;
  description?: string;
  spaceId?: string;
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not measured";
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}m ${safeSeconds % 60}s`;
}

function formatPosition(seconds: number | null): string {
  return seconds === null ? "Unavailable" : `${Math.max(0, Math.round(seconds))}s`;
}

function viewerLabel(session: ViewerSessionAnalytics): string {
  if (session.viewer_name?.trim()) return session.viewer_name.trim();
  if (session.viewer_email?.trim()) return session.viewer_email.trim();
  return session.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer";
}

function scopeLabel(scope: PlaybackMetricsScope): string {
  if (scope === "direct_url_native_html5") return "Native HTML5";
  if (scope === "youtube_iframe_api") return "YouTube IFrame API";
  return "Session only";
}

function telemetryLabel(session: ViewerSessionAnalytics): string {
  if (session.telemetry_state === "measured" || session.has_playback_telemetry) return `${scopeLabel(session.playback_metrics_scope)} telemetry measured`;
  if (session.telemetry_state === "unsupported" || session.playback_metrics_scope === "session_only") return "Session-only lifecycle";
  return `${scopeLabel(session.playback_metrics_scope)} available; no telemetry recorded`;
}

export default function ViewerAnalyticsPanel({
  sessions,
  title = "Viewer and session activity",
  description = "Each row is a real watch session recorded by TrackUp.",
  spaceId,
}: ViewerAnalyticsPanelProps) {
  const [query, setQuery] = useState("");
  const scoped = (path: string) => spaceId ? `${path}?space_id=${encodeURIComponent(spaceId)}` : path;
  const visibleSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => [
      session.viewer_identifier ?? "",
      session.viewer_profile_id ?? "",
      session.viewer_name ?? "",
      session.viewer_email ?? "",
      session.session_id,
      session.video_title,
      session.source_type,
    ].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, sessions]);
  const uniqueViewers = new Set(visibleSessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`)).size;
  const measuredSessions = visibleSessions.filter((session) => session.has_playback_telemetry);
  const measuredWatchTime = measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0);
  const averageWatchTime = measuredSessions.length > 0 ? measuredWatchTime / measuredSessions.length : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Users size={17} className="text-violet-300" />
          {title}
        </h2>
        <p className="mt-1 text-sm text-white/40">{description}</p>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-white/60 focus-within:border-violet-300/40">
        <Search size={15} className="shrink-0 text-white/35" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by viewer, email, session, video, or provider" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" aria-label="Filter viewer and session analytics" />
      </label>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Unique viewers</p><p className="mt-1 text-lg font-semibold text-white">{uniqueViewers}</p></div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Matching sessions</p><p className="mt-1 text-lg font-semibold text-white">{visibleSessions.length}</p></div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Measured watch time</p><p className="mt-1 text-lg font-semibold text-white">{formatDuration(measuredSessions.length > 0 ? measuredWatchTime : null)}</p></div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Average watch time</p><p className="mt-1 text-lg font-semibold text-white">{formatDuration(averageWatchTime)}</p></div>
      </div>

      {visibleSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <Eye size={28} className="mx-auto mb-3 text-white/15" />
          <p className="text-sm text-white/45">{sessions.length === 0 ? "No viewer sessions recorded yet." : "No sessions match this filter."}</p>
          <p className="mt-1 text-xs text-white/30">{sessions.length === 0 ? "Generate a TrackUp viewer link and identify the viewer before playback, or sign in with TrackUp." : "Try a different viewer, session, video, or provider filter."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSessions.map((session) => {
            const statusClass = session.telemetry_state === "measured"
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : session.telemetry_state === "unsupported"
                ? "border-white/10 bg-white/[0.04] text-white/55"
                : "border-amber-400/20 bg-amber-500/10 text-amber-100";
            return (
              <article key={session.session_id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{viewerLabel(session)}</p>
                    <p className="mt-1 truncate text-xs text-white/40">{session.video_title}</p>
                    <p className="mt-1 truncate text-[11px] text-white/30">{session.viewer_email ?? (session.viewer_status === "anonymous" ? "Legacy viewer" : "Authenticated viewer")} · Viewer ID {session.viewer_profile_id ?? session.viewer_identifier?.slice(0, 12) ?? "—"}</p>
                    <p className="mt-1 text-[11px] text-white/30">Session {session.session_number} of {session.session_count_for_viewer}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`w-fit rounded-full border px-2 py-1 text-[10px] ${statusClass}`}>{telemetryLabel(session)}</span>
                    <Link href={scoped(`/analytics/videos/${session.video_id}/sessions/${session.session_id}`)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-white/65 transition hover:border-violet-300/30 hover:text-white">View session</Link>
                    {(session.viewer_profile_id || session.viewer_identifier) && <Link href={scoped(`/analytics/videos/${session.video_id}/viewers/${encodeURIComponent(session.viewer_profile_id ?? session.viewer_identifier ?? "")}`)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-white/65 transition hover:border-violet-300/30 hover:text-white">View viewer</Link>}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><Clock3 size={12} /> Started</p><p className="mt-1 text-xs text-white/70">{formatDate(session.started_at)}</p></div>
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><PlayCircle size={12} /> First play</p><p className="mt-1 text-xs text-white/70">{formatDate(session.first_play_at)}</p></div>
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><Activity size={12} /> Last activity</p><p className="mt-1 text-xs text-white/70">{formatDate(session.last_activity_at)}</p></div>
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><Clock3 size={12} /> Ended</p><p className="mt-1 text-xs text-white/70">{formatDate(session.ended_at)}</p></div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/7 pt-3 text-xs text-white/45">
                  <span>Watch time: <strong className="font-medium text-white/75">{formatDuration(session.watch_time_seconds)}</strong></span>
                  <span>Last position: <strong className="font-medium text-white/75">{formatPosition(session.last_position)}</strong></span>
                  <span>Duration: <strong className="font-medium text-white/75">{formatPosition(session.last_duration)}</strong></span>
                  <span>Reached: <strong className="font-medium text-white/75">{session.completion_percentage === null ? "Not measured" : `${session.completion_percentage}%`}</strong></span>
                  <span>Events: <strong className="font-medium text-white/75">{session.playback_events.length}</strong></span>
                  <span>Provider: <strong className="font-medium capitalize text-white/75">{session.source_type.replace("_", " ")}</strong></span>
                  <span>Device: <strong className="font-medium text-white/75">{session.device_type ?? "Unknown"}</strong></span>
                  <span>Browser: <strong className="font-medium text-white/75">{session.browser ?? "Unknown"}</strong></span>
                  <span>OS: <strong className="font-medium text-white/75">{session.os ?? "Unknown"}</strong></span>
                </div>

                <p className="mt-3 text-[11px] leading-5 text-white/30">
                  {session.heatmap?.available
                    ? `Watched coverage reconstructed from ordered events across ${session.heatmap.ranges.length} range${session.heatmap.ranges.length === 1 ? "" : "s"}.`
                    : session.telemetry_state === "unsupported"
                      ? "This provider exposes session lifecycle only; playback position, duration, and watched ranges are unavailable."
                      : session.playback_events.length > 0
                        ? session.heatmap?.availability === "insufficient_data"
                          ? "Stored events exist, but their ordering or transitions are insufficient to reconstruct continuous watched ranges."
                          : "Stored events exist, but no event currently contains enough provider position and duration evidence to qualify this session as measured."
                        : "No playback telemetry is stored for this session."}
                </p>

                <details className="mt-3 rounded-xl border border-white/7 bg-black/10 px-3 py-2">
                  <summary className="cursor-pointer text-xs text-violet-200/80">View playback timeline ({session.playback_events.length} persisted events)</summary>
                  <div className="mt-3"><GroupedSessionTimeline events={session.playback_events} /></div>
                </details>
                <div className="mt-3 rounded-xl border border-white/7 bg-black/10 px-3 py-2 text-xs text-white/45">
                  <span className="font-medium text-white/70">Watched ranges:</span>{" "}
                  {session.heatmap?.available ? `${session.heatmap.ranges.length} reconstructed range${session.heatmap.ranges.length === 1 ? "" : "s"}` : session.heatmap?.availability === "not_available_from_provider" ? "Not available from provider" : session.heatmap?.availability === "insufficient_data" ? "No playback data" : "No telemetry"}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
