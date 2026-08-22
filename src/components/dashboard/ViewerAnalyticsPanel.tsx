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

function viewerLabel(identifier: string | null, sessionId: string): string {
  return identifier ? `Viewer ${identifier.slice(0, 8)}` : `Anonymous ${sessionId.slice(0, 8)}`;
}

export default function ViewerAnalyticsPanel({
  sessions,
  title = "Viewer and session activity",
  description = "Each row is a real watch session recorded by TrackUp.",
}: ViewerAnalyticsPanelProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Users size={17} className="text-violet-300" />
          {title}
        </h2>
        <p className="mt-1 text-sm text-white/40">{description}</p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <Eye size={28} className="mx-auto mb-3 text-white/15" />
          <p className="text-sm text-white/45">No viewer sessions recorded yet.</p>
          <p className="mt-1 text-xs text-white/30">Generate a TrackUp viewer link and open it to start a session.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const measured = session.playback_metrics_scope === "direct_url_native_html5";
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
                    {measured ? "Native playback measured" : "Session-only measurement"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><Clock3 size={12} /> Started</p>
                    <p className="mt-1 text-xs text-white/70">{formatDate(session.started_at)}</p>
                  </div>
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><PlayCircle size={12} /> First play</p>
                    <p className="mt-1 text-xs text-white/70">{formatDate(session.first_play_at)}</p>
                  </div>
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><Activity size={12} /> Last activity</p>
                    <p className="mt-1 text-xs text-white/70">{formatDate(session.last_activity_at)}</p>
                  </div>
                  <div className="rounded-xl border border-white/7 bg-black/10 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30"><Clock3 size={12} /> Ended</p>
                    <p className="mt-1 text-xs text-white/70">{formatDate(session.ended_at)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/7 pt-3 text-xs text-white/45">
                  <span>Watch time: <strong className="font-medium text-white/75">{formatDuration(session.watch_time_seconds)}</strong></span>
                  <span>Completion: <strong className="font-medium text-white/75">{session.completion_percentage === null ? "Unavailable" : `${session.completion_percentage}%`}</strong></span>
                  <span>Playback events: <strong className="font-medium text-white/75">{measured ? session.playback_events.length : "Unavailable"}</strong></span>
                  <span>Provider: <strong className="font-medium capitalize text-white/75">{session.source_type.replace("_", " ")}</strong></span>
                </div>

                {measured && session.playback_events.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Playback event timeline">
                    {session.playback_events.map((event) => (
                      <span key={event.id} className="rounded-md border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-white/45">
                        {event.event_type} · {Math.round(event.position)}s
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
