import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, BarChart3, CheckCircle2, Clock3, Eye, Layers3, Users } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getSpaceForUser, listSpacesForUser } from "@/src/lib/spaces/service";
import { getVideo, getVideoAnalytics } from "@/src/lib/videos/service";
import ViewerAnalyticsPanel from "@/src/components/dashboard/ViewerAnalyticsPanel";
import { AnalyticsMetricGrid, EmptyAnalytics, HeatmapPanel, formatAnalyticsDate, formatAnalyticsDuration } from "@/src/components/dashboard/AnalyticsDetail";

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ space_id?: string }>;
}

export default async function VideoAnalyticsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const user = await guardAuth();
  const query = await searchParams;
  const requestedSpaceId = query?.space_id?.trim() || null;
  let access;
  if (requestedSpaceId) {
    try {
      access = await getSpaceForUser(requestedSpaceId, user);
    } catch {
      redirect("/spaces?error=forbidden");
    }
  } else {
    const spaces = await listSpacesForUser(user);
    if (spaces.length > 1) redirect("/spaces?error=select_space");
    if (!spaces[0]) return <EmptyAnalytics title="No accessible Space" body="Join a Space before opening private analytics." />;
    try {
      access = await getSpaceForUser(spaces[0].id, user);
    } catch {
      redirect("/spaces?error=forbidden");
    }
  }
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!canManage) return <EmptyAnalytics title="Space admin access required" body="Per-video aggregate analytics are restricted to the platform owner and active Space admins." />;
  if (!access.space.clickup_workspace_id) return <EmptyAnalytics title="No ClickUp Workspace connected" body="Connect this Space before opening video analytics." />;
  const [video, analytics] = await Promise.all([
    getVideo(id, access.space.clickup_workspace_id, access.space.id),
    getVideoAnalytics(id, access.space.clickup_workspace_id, access.space.id),
  ]);
  if (!video || !analytics) return <EmptyAnalytics title="Video analytics unavailable" body="The video may not belong to this Space, or the analytics records could not be read." />;
  const measured = analytics.telemetry_health?.measured_sessions ?? analytics.viewer_sessions.filter((session) => session.has_playback_telemetry).length;
  const telemetryNote = analytics.playback_metrics_scope === "session_only" ? "Provider lifecycle only" : `${measured} measured session${measured === 1 ? "" : "s"}`;
  const scopeQuery = `?space_id=${encodeURIComponent(access.space.id)}`;

  return <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7"><div className="mx-auto max-w-[1440px] space-y-7"><header className="flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><Link href={`/analytics${scopeQuery}`} className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white" aria-label="Back to Space analytics"><ArrowLeft size={16} /></Link><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">{access.space.name} · video analytics</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{video.title}</h1><p className="mt-2 text-sm capitalize text-white/40">{video.source_type.replace("_", " ")} · Last activity {formatAnalyticsDate(analytics.last_activity_at)}</p></div></div><div className="flex flex-wrap gap-2"><Link href={`/videos/${video.id}${scopeQuery}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"><Eye size={14} />Video details</Link><span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/8 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 size={14} />{telemetryNote}</span></div></header><AnalyticsMetricGrid metrics={[{ label: "Total views", value: analytics.total_views.toLocaleString(), note: "Recorded TrackUp sessions", icon: Eye, tone: "text-violet-300" }, { label: "Unique viewers", value: analytics.unique_viewers.toLocaleString(), note: "Profile-backed or legacy hash", icon: Users, tone: "text-cyan-300" }, { label: "Sessions", value: analytics.total_sessions.toLocaleString(), note: "One record per visit", icon: Layers3, tone: "text-blue-300" }, { label: "Measured watch time", value: formatAnalyticsDuration(analytics.total_measurable_watch_time_seconds), note: "Provider telemetry only", icon: Clock3, tone: "text-emerald-300" }, { label: "Average watch time", value: formatAnalyticsDuration(analytics.avg_watch_time_seconds), note: "Measured sessions only", icon: Clock3, tone: "text-cyan-300" }, { label: "Average completion", value: analytics.avg_completion_percentage === null ? "Not measured" : `${analytics.avg_completion_percentage}%`, note: "Real stored telemetry", icon: BarChart3, tone: "text-blue-300" }, { label: "Completion rate", value: analytics.completion_rate === null ? "Not measured" : `${analytics.completion_rate}%`, note: "Sessions reaching 90%+", icon: CheckCircle2, tone: "text-amber-300" }, { label: "Last activity", value: formatAnalyticsDate(analytics.last_activity_at), note: "Session/event timestamp", icon: Activity, tone: "text-violet-300" }]} /><section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><HeatmapPanel heatmap={analytics.heatmap} /><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Measurement scope</p><h2 className="mt-2 text-base font-semibold text-white">Provider capabilities</h2><div className="mt-5 space-y-4 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-white/45">Provider</span><span className="capitalize text-white/80">{video.source_type.replace("_", " ")}</span></div><div className="flex items-center justify-between gap-4"><span className="text-white/45">Playback scope</span><span className="text-right text-white/80">{analytics.playback_metrics_scope.replaceAll("_", " ")}</span></div><div className="flex items-center justify-between gap-4"><span className="text-white/45">Measured sessions</span><span className="text-white/80">{measured} / {analytics.total_sessions}</span></div><div className="flex items-center justify-between gap-4"><span className="text-white/45">Unsupported/session-only</span><span className="text-white/80">{analytics.telemetry_health?.unsupported_sessions ?? 0}</span></div></div><div className="mt-6 flex items-start gap-3 border-t border-white/8 pt-5 text-xs leading-5 text-white/38"><Activity size={15} className="mt-0.5 shrink-0 text-violet-300" /><span>Only stored provider events can populate position, duration, completion, watch time, or ranges. No playback data is inferred from page opens.</span></div></article></section><ViewerAnalyticsPanel sessions={analytics.viewer_sessions} title="Viewers and sessions" description="Each row is a real session. Open a viewer or session to inspect its identity, lifecycle, events, and provider limitations." /></div></div>;
}
