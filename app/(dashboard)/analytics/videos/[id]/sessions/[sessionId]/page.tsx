import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, CheckCircle2, Clock3, Eye, Monitor, PlayCircle, ShieldAlert } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getVideoSessionAnalytics } from "@/src/lib/videos/service";
import { getSafeSpaceDisplayName } from "@/src/lib/spaces/labels";
import { AnalyticsMetricGrid, EmptyAnalytics, HeatmapPanel, SessionTimeline, formatAnalyticsDate, formatAnalyticsDuration, formatAnalyticsPosition, telemetryClass, telemetryCopy } from "@/src/components/dashboard/AnalyticsDetail";

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams?: Promise<{ space_id?: string; organization_id?: string }>;
}

export default async function SessionAnalyticsPage({ params, searchParams }: Props) {
  const { id, sessionId } = await params;
  const user = await guardAuth();
  const query = await searchParams;
  const requestedSpaceId = query?.space_id?.trim() || null;
  const requestedOrganizationId = query?.organization_id?.trim() || null;
  const resolution = await resolveActiveSpaceForUser(user, { requestedSpaceId, requestedOrganizationId });
  if (resolution.requestedSpaceInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");
  const access = resolution.access;
  const organizationScope = resolution.context.type === "all"
    ? resolution.organization ? organizationDataScope(resolution.organization) : null
    : null;
  const spaceScope = access ? spaceDataScope(access.space) : null;
  const scope = organizationScope ?? spaceScope;
  const canManage = organizationScope ? user.role === "owner" : Boolean(access?.is_platform_owner || access?.membership?.role === "admin");
  if (!scope || !canManage) return <EmptyAnalytics title="Space admin access required" body="Session analytics are restricted to the platform owner and active Space admins." />;
  const session = await getVideoSessionAnalytics(id, scope, sessionId);
  if (!session) return <EmptyAnalytics title="Session analytics unavailable" body="This session is not present in the selected authorized Organization or Space." />;
  const viewerId = session.viewer_profile_id ?? session.viewer_identifier;
  const displaySpaceName = organizationScope ? "All Spaces" : getSafeSpaceDisplayName(access?.space.name ?? "Space", access?.organization?.name);
  const scopeQuery = organizationScope
    ? `?organization_id=${encodeURIComponent(resolution.organization?.id ?? "")}`
    : spaceScope ? `?space_id=${encodeURIComponent(spaceScope.spaceId)}` : "";
  const viewerHref = viewerId ? `/analytics/videos/${id}/viewers/${encodeURIComponent(viewerId)}${scopeQuery}` : null;

  return <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7"><div className="mx-auto max-w-[1200px] space-y-7"><header className="flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><Link href={`/analytics/videos/${id}${scopeQuery}`} className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white" aria-label="Back to video analytics"><ArrowLeft size={16} /></Link><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">{resolution.organization?.name ?? access?.organization?.name ?? "Organization"} / {displaySpaceName} · session analytics</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{session.video_title}</h1><p className="mt-2 break-words text-sm text-white/40">{session.viewer_name || session.viewer_email || (session.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer")} · session {session.session_number}</p></div></div><div className="flex flex-wrap gap-2"><span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${telemetryClass(session.telemetry_state)}`}>{session.telemetry_state === "measured" ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}{telemetryCopy(session.telemetry_state)}</span>{viewerHref && <Link href={viewerHref} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white">Viewer profile</Link>}</div></header><AnalyticsMetricGrid metrics={[{ label: "Started", value: formatAnalyticsDate(session.started_at), note: "Session creation time", icon: Clock3, tone: "text-violet-300" }, { label: "First play", value: formatAnalyticsDate(session.first_play_at), note: "Actual provider play event", icon: PlayCircle, tone: "text-emerald-300" }, { label: "Last activity", value: formatAnalyticsDate(session.last_activity_at), note: "Latest stored event/session update", icon: Activity, tone: "text-cyan-300" }, { label: "Ended", value: formatAnalyticsDate(session.ended_at), note: "Natural end or viewer leave", icon: CheckCircle2, tone: "text-blue-300" }, { label: "Watch time", value: formatAnalyticsDuration(session.watch_time_seconds), note: "Measured only when telemetry qualifies", icon: Clock3, tone: "text-emerald-300" }, { label: "Last position", value: formatAnalyticsPosition(session.last_position), note: "Provider-reported playhead", icon: Eye, tone: "text-violet-300" }, { label: "Completion", value: session.completion_percentage === null ? "Not measured" : `${session.completion_percentage}%`, note: "Stored provider-backed summary", icon: CheckCircle2, tone: "text-amber-300" }, { label: "Device", value: session.device_type ?? "Unknown", note: `${session.browser ?? "Unknown browser"} · ${session.os ?? "Unknown OS"}`, icon: Monitor, tone: "text-cyan-300" }]} /><section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><HeatmapPanel heatmap={session.heatmap} /><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Provider contract</p><h2 className="mt-2 text-base font-semibold text-white">What this session proves</h2><div className="mt-5 space-y-4 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-white/45">Provider</span><span className="capitalize text-white/80">{session.source_type.replace("_", " ")}</span></div><div className="flex items-center justify-between gap-4"><span className="text-white/45">Events stored</span><span className="text-white/80">{session.playback_events.length}</span></div><div className="flex items-center justify-between gap-4"><span className="text-white/45">Playback scope</span><span className="text-right text-white/80">{session.playback_metrics_scope.replaceAll("_", " ")}</span></div><div className="flex items-center justify-between gap-4"><span className="text-white/45">Duration</span><span className="text-white/80">{formatAnalyticsPosition(session.last_duration)}</span></div></div><p className="mt-6 border-t border-white/8 pt-5 text-xs leading-5 text-white/38">{session.telemetry_state === "unsupported" ? "This provider supports session lifecycle only. Position, duration, completion, watch time, and ranges are not available." : session.heatmap?.available ? "Playback coverage is reconstructed from ordered events and provider-reported positions." : "The session does not yet contain enough ordered telemetry to prove continuous watched coverage."}</p></article></section><SessionTimeline session={session} /></div></div>;
}
