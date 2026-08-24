import Link from "next/link";
import { Activity, CheckCircle2, Eye, ShieldAlert, Users, XCircle } from "lucide-react";
import type { AnalyticsViewerSummary, HeatmapAvailability, PlaybackHeatmap, ViewerSessionAnalytics } from "@/src/types/video";
import GroupedSessionTimeline from "@/src/components/analytics/GroupedSessionTimeline";

export function formatAnalyticsDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

export function formatAnalyticsDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "Not measured";
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  return `${Math.floor(safe / 60)}m ${safe % 60}s`;
}

export function formatAnalyticsPosition(seconds: number | null): string {
  return seconds === null || !Number.isFinite(seconds) ? "Unavailable" : `${Math.max(0, Math.round(seconds))}s`;
}

export function telemetryCopy(state: ViewerSessionAnalytics["telemetry_state"] | AnalyticsViewerSummary["telemetry_state"]): string {
  if (state === "measured") return "Measured telemetry";
  if (state === "unsupported") return "Not available from provider";
  return "No telemetry";
}

export function telemetryClass(state: ViewerSessionAnalytics["telemetry_state"] | AnalyticsViewerSummary["telemetry_state"]): string {
  if (state === "measured") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  if (state === "unsupported") return "border-white/10 bg-white/[0.04] text-white/50";
  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}

export function AnalyticsMetricGrid({ metrics }: { metrics: Array<{ label: string; value: string; note: string; icon: typeof Eye; tone?: string }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ label, value, note, icon: Icon, tone = "text-violet-300" }) => (
        <article key={label} className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
          <Icon size={17} className={tone} />
          <p className="mt-4 break-words text-2xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-xs font-medium text-white/65">{label}</p>
          <p className="mt-1 break-words text-[11px] leading-5 text-white/30">{note}</p>
        </article>
      ))}
    </div>
  );
}

function viewerDisplayName(viewer: AnalyticsViewerSummary): string {
  if (viewer.viewer_name?.trim()) return viewer.viewer_name.trim();
  if (viewer.viewer_email?.trim()) return viewer.viewer_email.trim();
  return viewer.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer";
}

function viewerStatusLabel(viewer: AnalyticsViewerSummary): string {
  if (viewer.viewer_status !== "identified") return "Legacy viewer";
  return viewer.viewer_is_active === false ? "Inactive profile" : "Active profile";
}

export function ViewerIdentityCard({ viewer }: { viewer: AnalyticsViewerSummary }) {
  const viewerId = viewer.viewer_id || viewer.viewer_identifier || "—";
  const statusClass = viewer.viewer_status === "identified" && viewer.viewer_is_active !== false
    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
    : "border-white/10 bg-white/[0.04] text-white/50";

  return (
    <article className="rounded-3xl border border-white/9 bg-white/[0.035] p-4 sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><Users size={19} /></div>
          <div className="min-w-0">
            <p className="break-words text-base font-semibold text-white">{viewerDisplayName(viewer)}</p>
            <p className="mt-1 break-all text-xs text-white/40">{viewer.viewer_email ?? (viewer.viewer_status === "identified" ? "Email unavailable" : "No authenticated profile")}</p>
            <p className="mt-1 break-all text-[11px] text-white/30">Viewer ID {viewerId}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`w-fit rounded-full border px-2.5 py-1.5 text-[10px] ${statusClass}`}>{viewerStatusLabel(viewer)}</span>
          <span className={`w-fit rounded-full border px-2.5 py-1.5 text-[10px] ${telemetryClass(viewer.telemetry_state)}`}>{telemetryCopy(viewer.telemetry_state)}</span>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <DetailStat label="Sessions" value={String(viewer.total_sessions)} />
        <DetailStat label="Videos watched" value={String(viewer.videos_watched)} />
        <DetailStat label="Total watch time" value={formatAnalyticsDuration(viewer.total_watch_time_seconds)} />
        <DetailStat label="Average completion" value={viewer.avg_completion_percentage === null ? "Not measured" : `${viewer.avg_completion_percentage}%`} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 border-t border-white/7 pt-4 text-xs text-white/45 min-[480px]:grid-cols-2 lg:grid-cols-3">
        <span>First seen: <strong className="font-medium text-white/70">{formatAnalyticsDate(viewer.first_seen_at)}</strong></span>
        <span>Last seen: <strong className="font-medium text-white/70">{formatAnalyticsDate(viewer.last_seen_at)}</strong></span>
        <span>Device: <strong className="font-medium text-white/70">{viewer.device_type ?? "Unknown"}</strong></span>
        <span>Browser: <strong className="font-medium text-white/70">{viewer.browser ?? "Unknown"}</strong></span>
        <span>OS: <strong className="font-medium text-white/70">{viewer.os ?? "Unknown"}</strong></span>
      </div>
    </article>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/7 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-[0.15em] text-white/30">{label}</p><p className="mt-2 break-words text-sm font-semibold text-white/85">{value}</p></div>;
}

export function HeatmapPanel({ heatmap }: { heatmap: PlaybackHeatmap | null | undefined }) {
  const availability = heatmap?.availability ?? "no_telemetry";
  const copy: Record<HeatmapAvailability, { title: string; body: string }> = {
    measured: { title: "Watched coverage", body: "Reconstructed from ordered playback transitions and heartbeat positions." },
    no_telemetry: { title: "No playback data", body: "Playback has not produced enough stored telemetry for coverage reconstruction." },
    insufficient_data: { title: "Insufficient playback data", body: "Events exist, but their ordering or transitions are insufficient for a defensible range." },
    not_available_from_provider: { title: "Not available from provider", body: "This provider exposes session lifecycle only; TrackUp does not invent playback ranges." },
  };
  const content = copy[availability];

  return (
    <article className="min-w-0 rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Playback coverage</p><h2 className="mt-2 text-base font-semibold text-white">{content.title}</h2><p className="mt-2 max-w-xl break-words text-xs leading-5 text-white/40">{content.body}</p></div>
        {availability === "measured" ? <CheckCircle2 size={18} className="shrink-0 text-emerald-300" /> : <ShieldAlert size={18} className="shrink-0 text-amber-200/70" />}
      </div>
      {heatmap?.available ? (
        <div className="mt-6 min-w-0">
          <div className="flex h-12 min-w-0 items-end gap-0.5 overflow-hidden rounded-xl border border-white/7 bg-black/15 p-2">{heatmap.buckets.map((bucket) => <span key={`${bucket.start}-${bucket.end}`} title={`${Math.round(bucket.start)}–${Math.round(bucket.end)}s · ${bucket.coverage_percentage}%`} className="min-w-[2px] flex-1 rounded-sm bg-linear-to-t from-violet-500 to-cyan-300" style={{ height: `${Math.max(8, bucket.coverage_percentage)}%`, opacity: 0.3 + bucket.coverage_percentage / 140 }} />)}</div>
          <div className="mt-3 flex justify-between gap-3 text-[10px] text-white/30"><span>0:00</span><span>{formatAnalyticsDuration(heatmap.duration_seconds)}</span></div>
          <p className="mt-3 break-words text-xs text-white/45">{heatmap.ranges.length} reconstructed watched range{heatmap.ranges.length === 1 ? "" : "s"} · bucket size {heatmap.bucket_size_seconds}s</p>
        </div>
      ) : <div className="mt-6 flex min-h-20 items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center text-xs text-white/30">{content.title}</div>}
    </article>
  );
}

export function SessionTimeline({ session }: { session: ViewerSessionAnalytics }) {
  return (
    <article className="min-w-0 rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Session timeline</p><h2 className="mt-2 text-base font-semibold text-white">{session.playback_events.length ? `${session.playback_events.length} persisted playback events` : "No stored playback events"}</h2><p className="mt-2 break-words text-xs leading-5 text-white/40">Meaningful actions are prioritized; heartbeat samples stay available in a collapsed progress group and raw event data remains available on demand.</p></div><Activity size={18} className="shrink-0 text-violet-300" /></div>
      <div className="mt-6"><GroupedSessionTimeline events={session.playback_events} /></div>
    </article>
  );
}

export function SessionList({ sessions }: { sessions: ViewerSessionAnalytics[] }) {
  return <div className="space-y-3">{sessions.map((session) => <article key={session.session_id} className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.03] p-4"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-medium text-white">{session.viewer_name || session.viewer_email || (session.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer")}</p><p className="mt-1 break-words text-xs text-white/40">{session.video_title}</p><p className="mt-1 break-all text-[11px] text-white/30">{session.viewer_email ?? (session.viewer_status === "identified" ? "Email unavailable" : "Legacy viewer")} · Viewer ID {session.viewer_profile_id ?? session.viewer_identifier ?? "—"}</p><p className="mt-1 text-[11px] text-white/30">{formatAnalyticsDate(session.started_at)} · {session.session_number} of {session.session_count_for_viewer}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end"><span className={`w-fit rounded-full border px-2 py-1 text-[10px] ${telemetryClass(session.telemetry_state)}`}>{telemetryCopy(session.telemetry_state)}</span><Link href={`/analytics/videos/${session.video_id}/sessions/${session.session_id}`} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/65 hover:border-violet-300/30 hover:text-white">Open session</Link></div></div><div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-3"><DetailStat label="Watch time" value={formatAnalyticsDuration(session.watch_time_seconds)} /><DetailStat label="Last position" value={formatAnalyticsPosition(session.last_position)} /><DetailStat label="Events" value={String(session.playback_events.length)} /></div></article>)}</div>;
}

export function EmptyAnalytics({ title, body, icon: Icon = XCircle }: { title: string; body: string; icon?: typeof XCircle }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center"><Icon size={22} className="text-white/20" /><p className="mt-3 break-words text-sm text-white/45">{title}</p><p className="mt-1 max-w-md break-words text-xs leading-5 text-white/30">{body}</p></div>;
}
