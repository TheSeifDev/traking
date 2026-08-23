import Link from "next/link";
import { Activity, ArrowLeft, Clock3, Eye, Layers3, PlaySquare } from "lucide-react";
import type { WorkspaceAnalytics } from "@/src/types/video";
import type { AccessibleSpace } from "@/src/types/space";
import ViewerAnalyticsPanel from "@/src/components/dashboard/ViewerAnalyticsPanel";

function duration(value: number | null): string {
  if (value === null) return "Not measured";
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function PersonalSpaceAnalytics({ space, analytics }: { space: AccessibleSpace; analytics: WorkspaceAnalytics }) {
  const sessions = analytics.viewer_sessions;
  const watchedVideos = new Set(sessions.map((session) => session.video_id)).size;
  const measured = sessions.filter((session) => session.has_playback_telemetry);
  const completion = measured.length > 0 ? Math.round(measured.reduce((sum, session) => sum + (session.completion_percentage ?? 0), 0) / measured.length) : null;
  return <div className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1440px] space-y-7"><header className="flex flex-col gap-4 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><Link href={`/spaces/${space.id}`} className="inline-flex items-center gap-1.5 text-xs text-white/38 transition hover:text-violet-200"><ArrowLeft size={14} />Back to Space</Link><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Personal activity</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white">Your viewing</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Only sessions attributed to your authenticated TrackUp profile are included. Space admins can access aggregate Space analytics.</p></div><Link href={`/videos?space_id=${encodeURIComponent(space.id)}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"><PlaySquare size={15} />Open videos</Link></header><section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/9 bg-white/9 sm:grid-cols-4"><Metric label="Sessions" value={String(sessions.length)} detail="Your persisted visits" icon={Layers3} /><Metric label="Videos watched" value={String(watchedVideos)} detail="Distinct Space videos" icon={PlaySquare} /><Metric label="Measured time" value={duration(analytics.total_measurable_watch_time_seconds)} detail={measured.length ? "Provider telemetry" : "No measurable events"} icon={Clock3} /><Metric label="Completion" value={completion === null ? "Not measured" : `${completion}%`} detail="Measured sessions only" icon={Eye} /></section><section className="rounded-3xl border border-white/9 bg-white/[0.035] p-5 sm:p-6"><div className="flex items-center gap-2"><Activity size={17} className="text-violet-300" /><h2 className="text-sm font-semibold text-white">Your session timeline</h2></div><p className="mt-1 text-xs leading-5 text-white/35">Playback positions, events, duration, and ranges appear only when the provider supplied and TrackUp persisted reliable telemetry.</p><div className="mt-5"><ViewerAnalyticsPanel spaceId={space.id} sessions={sessions} title="Your sessions" description="These are real sessions tied to your authenticated TrackUp profile. Unsupported provider measurements remain unavailable." /></div></section></div></div>;
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) { return <article className="min-w-0 bg-[#10102d] p-4 sm:p-5"><div className="flex items-center gap-2 text-xs font-medium text-white/45"><Icon size={15} className="text-violet-300/80" />{label}</div><p className="mt-4 truncate text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 truncate text-[11px] text-white/30">{detail}</p></article>; }
