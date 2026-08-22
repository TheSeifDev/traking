import { Activity, Clock3, Eye, PlayCircle, Users } from "lucide-react";
import type { ViewerSessionAnalytics } from "@/src/types/video";

interface ViewerAnalyticsPanelProps {
  sessions: ViewerSessionAnalytics[];
  title?: string;
  description?: string;
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Unavailable";
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}m ${safeSeconds % 60}s`;
}

function formatPosition(seconds: number | null): string {
  return seconds === null ? "Unavailable" : `${Math.max(0, Math.round(seconds))}s`;
}

function viewerLabel(identifier: string | null, sessionId: string): string {
  return identifier ? `Viewer ${identifier.slice(0, 8)}` : `Legacy anonymous ${sessionId.slice(0, 8)}`;
}

export default function ViewerAnalyticsPanel({
  sessions,
  title = "Viewer and session activity",
  description = "Each row is a real watch session recorded by TrackUp.",
}: ViewerAnalyticsPanelProps) {
  const uniqueViewers = new Set(sessions.map((session) => session.viewer_identifier ?? session.session_id)).size;
  const measurableSessions = sessions.filter((session) => session.playback_metrics_scope !== "session_only");
  const measuredWatchTime = measurableSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0);
  const averageWatchTime = measurableSessions.length > 0 ? measuredWatchTime / measurableSessions.length : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Users size={17} className="text-violet-300" />
          {title}
        </h2>
        <p className="mt-1 text-sm text-white/40">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Total viewers</p><p className="mt-1 text-lg font-semibold text-white">{uniqueViewers}</p></div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Total sessions</p><p className="mt-1 text-lg font-semibold text-white">{sessions.length}</p></div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Measured watch time</p><p className="mt-1 text-lg font-semibold text-white">{formatDuration(measurableSessions.length > 0 ? measuredWatchTime : null)}</p></div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wide text-white/30">Average watch time</p><p className="mt-1 text-lg font-semibold text-white">{formatDuration(averageWatchTime)}</p></div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <Eye size={28} className="mx-auto mb-3 text-white/15" />
          <p className="text-sm text-white/45">No viewer sessions recorded yet.</p>
          <p className="mt-1 text-xs text-white/30">Generate a TrackUp viewer link and sign in to open it and start playback.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const measured = session.playback_metrics_scope !== "session_only";
            return (
              <article key={session.session_id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {viewerLabel(session.viewer_identifier, session.session_id)}
                    </p>
                    <p className="mt-1 truncate text-xs text-white/40">{session.video_title}</p>
                    <p className="mt-1 text-[11px] text-white/30">
                      Session {session.session_number} of {session.session_count_for_viewer} for this viewer
                    </p>
                  </div>
                  <span className={`w-fit rounded-full border px-2 py-1 text-[10px] ${measured ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-amber-400/20 bg-amber-500/10 text-amber-100"}`}>
                    {session.playback_metrics_scope === "direct_url_native_html5" ? "Native HTML5 measured" : session.playback_metrics_scope === "youtube_iframe_api" ? "YouTube IFrame API measured" : "Session-only measurement"}
                  </span>
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
                  <span>Reached: <strong className="font-medium text-white/75">{session.completion_percentage === null ? "Unavailable" : `${session.completion_percentage}%`}</strong></span>
                  <span>Events: <strong className="font-medium text-white/75">{measured ? session.playback_events.length : "Unavailable"}</strong></span>
                  <span>Provider: <strong className="font-medium capitalize text-white/75">{session.source_type.replace("_", " ")}</strong></span>
                </div>

                <p className="mt-3 text-[11px] leading-5 text-white/30">{measured ? "Coverage ranges and heatmaps are intentionally unavailable until the stored telemetry can reconstruct them reliably." : "Playback coverage, ranges, and heatmaps are unavailable for this provider."}</p>

                {measured && (
                  <details className="mt-3 rounded-xl border border-white/7 bg-black/10 px-3 py-2">
                    <summary className="cursor-pointer text-xs text-violet-200/80">View stored playback timeline ({session.playback_events.length} events)</summary>
                    {session.playback_events.length === 0 ? (
                      <p className="mt-3 text-xs text-white/35">No playback events were stored for this session.</p>
                    ) : (
                      <div className="mt-3 space-y-1.5" aria-label="Playback event timeline">
                        {session.playback_events.map((event) => (
                          <div key={event.id} className="flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-white/8 bg-white/[0.04] px-2 py-1.5 text-[10px] text-white/50">
                            <span className="font-medium text-white/75">{event.event_type}</span>
                            <span>position {formatPosition(event.position)}</span>
                            {event.from_position !== null && <span>from {formatPosition(event.from_position)}</span>}
                            {event.duration !== null && <span>duration {formatPosition(event.duration)}</span>}
                            <span>{formatDate(event.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
