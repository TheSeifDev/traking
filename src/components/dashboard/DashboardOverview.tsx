"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  FileVideo,
  Link2,
  LockKeyhole,
  PlayCircle,
  Plus,
  ShieldCheck,
  UsersRound,
  Video as VideoIcon,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UserRole } from "@/src/types/auth";
import type { Video, ViewerSessionAnalytics, WorkspaceAnalytics } from "@/src/types/video";
import { getProviderAdapter, getProviderLabel } from "@/src/lib/playback/providers";

interface DashboardOverviewProps {
  user: { name: string | null; email: string; role: UserRole };
  analytics: WorkspaceAnalytics;
  videos: Video[];
  error?: string | null;
  spaceId: string | null;
  organizationId?: string | null;
  scopeType?: "specific" | "all";
  canManage: boolean;
}

type DateRange = "7" | "30" | "all";
type Tone = "violet" | "blue" | "cyan" | "emerald" | "amber";

const rangeLabels: Record<DateRange, string> = { "7": "7d", "30": "30d", all: "All time" };

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not measurable";
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  if (safe < 3600) return `${Math.floor(safe / 60)}m ${safe % 60}s`;
  return `${Math.floor(safe / 3600)}h ${Math.floor((safe % 3600) / 60)}m`;
}

function formatProvider(sourceType: Video["source_type"]): string {
  return getProviderLabel(sourceType);
}

function formatRelative(value: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


function isActiveLink(link: NonNullable<Video["watch_links"]>[number], now: number): boolean {
  return !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now);
}

function telemetryNote(measured: number, total: number): string {
  if (measured > 0) return `${measured} measured session${measured === 1 ? "" : "s"}`;
  if (total > 0) return "Provider telemetry unavailable";
  return "No sessions recorded yet";
}

function actionLabel(session: ViewerSessionAnalytics): string {
  const latest = session.playback_events[session.playback_events.length - 1];
  if (!latest) return "Opened viewer";
  if (latest.event_type === "complete") return "Completed video";
  if (latest.event_type === "ended") return "Left viewer";
  if (latest.event_type === "resume") return "Resumed playback";
  if (latest.event_type === "pause") return "Paused playback";
  if (latest.event_type === "seek") return "Seeked playback";
  if (latest.event_type === "heartbeat") return "Watched video";
  return "Started playback";
}

function toneClasses(tone: Tone): { icon: string; value: string; line: string } {
  const tones: Record<Tone, { icon: string; value: string; line: string }> = {
    violet: { icon: "bg-violet-400/12 text-violet-200", value: "text-white", line: "bg-violet-400" },
    blue: { icon: "bg-blue-400/12 text-blue-200", value: "text-white", line: "bg-blue-400" },
    cyan: { icon: "bg-cyan-400/12 text-cyan-200", value: "text-white", line: "bg-cyan-400" },
    emerald: { icon: "bg-emerald-400/12 text-emerald-200", value: "text-white", line: "bg-emerald-400" },
    amber: { icon: "bg-amber-400/12 text-amber-200", value: "text-white", line: "bg-amber-400" },
  };
  return tones[tone];
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Activity; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.018] px-6 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/30"><Icon size={18} /></div>
      <h3 className="mt-4 text-sm font-semibold text-white/80">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-white/38">{body}</p>
      {action}
    </div>
  );
}

export default function DashboardOverview({ user, analytics, videos, error = null, spaceId, organizationId = null, scopeType = "specific", canManage }: DashboardOverviewProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30");
  const [now] = useState(() => Date.now());
  const firstName = user.name?.trim().split(/\s+/)[0] ?? user.email.split("@")[0];
  const scoped = (path: string) => {
    const parameter = spaceId ? `space_id=${encodeURIComponent(spaceId)}` : organizationId ? `organization_id=${encodeURIComponent(organizationId)}` : "";
    return parameter ? `${path}${path.includes("?") ? "&" : "?"}${parameter}` : path;
  };
  const scopedVideo = (path: string) => scoped(path);

  const filteredSessions = useMemo(() => {
    const cutoff = dateRange === "all" ? null : now - Number(dateRange) * 24 * 60 * 60 * 1000;
    return analytics.viewer_sessions.filter((session) => cutoff === null || new Date(session.started_at).getTime() >= cutoff);
  }, [analytics.viewer_sessions, dateRange, now]);

  const measuredSessions = filteredSessions.filter((session) => session.has_playback_telemetry && session.watch_time_seconds !== null);
  const measuredCompletions = filteredSessions.filter((session) => session.completion_percentage !== null);
  const totalMeasuredWatchTime = measuredSessions.length > 0 ? measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0) : null;
  const averageWatchTime = measuredSessions.length > 0 ? (totalMeasuredWatchTime ?? 0) / measuredSessions.length : null;
  const completionRate = measuredCompletions.length > 0
    ? Math.round((measuredCompletions.filter((session) => (session.completion_percentage ?? 0) >= 90).length / measuredCompletions.length) * 100)
    : null;
  const uniqueViewers = new Set(filteredSessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`)).size;

  const activity = useMemo(() => {
    const grouped = new Map<string, { date: string; views: number; sessions: number }>();
    for (const session of filteredSessions) {
      const date = session.started_at.slice(0, 10);
      const point = grouped.get(date) ?? { date, views: 0, sessions: 0 };
      point.views += 1;
      point.sessions += 1;
      grouped.set(date, point);
    }
    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSessions]);

  const topVideos = useMemo(() => videos.map((video) => {
    const sessions = filteredSessions.filter((session) => session.video_id === video.id);
    const measured = sessions.filter((session) => session.has_playback_telemetry && session.watch_time_seconds !== null);
    const watchTime = measured.length > 0 ? measured.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0) : null;
    const completions = measured.filter((session) => session.completion_percentage !== null);
    const completion = completions.length > 0 ? Math.round(completions.reduce((sum, session) => sum + (session.completion_percentage ?? 0), 0) / completions.length) : null;
    return {
      video,
      sessions: sessions.length,
      viewers: new Set(sessions.map((session) => session.viewer_profile_id ?? session.viewer_identifier ?? `anonymous:${session.session_id}`)).size,
      measuredWatchTime: watchTime,
      completion,
    };
  }).filter((item) => item.sessions > 0).sort((a, b) => b.sessions - a.sessions || a.video.title.localeCompare(b.video.title)).slice(0, 5), [filteredSessions, videos]);

  const recentActivity = filteredSessions.slice().sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()).slice(0, 6);

  const linkHealth = useMemo(() => {
    const links = videos.flatMap((video) => (video.watch_links ?? []).map((link) => ({ ...link, videoTitle: video.title })));
    const active = links.filter((link) => isActiveLink(link, now));
    const revoked = links.filter((link) => Boolean(link.revoked_at));
    const videosWithLinks = new Set(active.map((link) => link.video_id)).size;
    return { active: active.length, revoked: revoked.length, videosWithLinks, videosWithoutLinks: Math.max(0, videos.length - videosWithLinks) };
  }, [now, videos]);

  const recentVideos = videos.slice(0, 5);
  const metrics = [
    { label: "Total videos", value: analytics.total_videos.toLocaleString(), note: "Workspace library", icon: VideoIcon, tone: "violet" as const },
    { label: "Viewer sessions", value: filteredSessions.length.toLocaleString(), note: `${rangeLabels[dateRange]} · real records`, icon: Eye, tone: "blue" as const },
    { label: "Unique viewers", value: uniqueViewers.toLocaleString(), note: "Authenticated profiles; legacy fallback", icon: UsersRound, tone: "cyan" as const },
    { label: "Active links", value: linkHealth.active.toLocaleString(), note: "One per video maximum", icon: Link2, tone: "emerald" as const },
    { label: "Measured watch time", value: formatDuration(totalMeasuredWatchTime), note: telemetryNote(measuredSessions.length, filteredSessions.length), icon: Clock3, tone: "amber" as const },
    { label: "Average watch time", value: formatDuration(averageWatchTime), note: measuredSessions.length ? "Measured sessions only" : "Provider telemetry unavailable", icon: Activity, tone: "blue" as const },
    { label: "Completion rate", value: completionRate === null ? "Not measurable" : `${completionRate}%`, note: completionRate === null ? "Reliable playback data required" : "Sessions reaching 90%+", icon: CheckCircle2, tone: "emerald" as const },
  ];

  return (
    <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1440px] space-y-8">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/70"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" />{scopeType === "all" ? "Organization overview" : analytics.total_videos > 0 ? "Workspace overview" : "Workspace setup"}</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Good to see you, {firstName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Your command center for video access, real viewing activity, and provider-aware measurement.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && <Link href={scoped("/videos")} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(124,58,237,0.28)] transition hover:bg-violet-400 active:scale-[0.98]"><Plus size={16} />Add video</Link>}
            <Link href={scoped("/analytics")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"><BarChart3 size={16} />View analytics</Link>
          </div>
        </header>

        {error && <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100"><XCircle size={17} className="mt-0.5 shrink-0 text-red-300" /><div><p className="font-medium">Dashboard data is temporarily unavailable</p><p className="mt-1 text-xs text-red-100/60">The interface is showing safe empty states. Refresh the page to retry.</p></div></div>}

        <section aria-label="Workspace metrics" className="grid grid-cols-1 gap-x-4 gap-y-5 border-b min-[360px]:grid-cols-2 border-white/8 pb-7 sm:grid-cols-4 xl:grid-cols-7">
          {metrics.map(({ label, value, note, icon: Icon, tone }) => {
            const colors = toneClasses(tone);
            return <article key={label} className="relative min-w-0"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.icon}`}><Icon size={17} /></div><p className={`mt-4 truncate text-2xl font-semibold tracking-[-0.035em] ${colors.value}`}>{value}</p><p className="mt-1 text-xs font-medium text-white/65">{label}</p><p className="mt-1 truncate text-[10px] text-white/30">{note}</p><div className={`absolute bottom-[-31px] left-0 h-px w-10 ${colors.line} opacity-70`} /></article>;
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.45fr)]">
          <article className="min-w-0 rounded-3xl border border-white/9 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><SectionHeading eyebrow="Watch activity" title="Sessions over time" action={<Link href={scoped("/analytics")} className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 transition hover:text-violet-200">Open report <ArrowUpRight size={13} /></Link>} /><div className="flex shrink-0 rounded-xl border border-white/8 bg-black/15 p-1">{(Object.keys(rangeLabels) as DateRange[]).map((range) => <button key={range} onClick={() => setDateRange(range)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${dateRange === range ? "bg-white/10 text-white" : "text-white/38 hover:text-white/70"}`}>{rangeLabels[range]}</button>)}</div></div>
            <p className="mt-2 text-xs text-white/35">Real sessions grouped by start date. Playback metrics remain separate from session volume.</p>
            {activity.length === 0 ? <div className="mt-7"><EmptyState icon={Activity} title="No activity in this range" body="Share a viewer link and have someone open it to start building this workspace timeline." action={<Link href={scoped("/watch-links")} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-300">Manage viewer links <ChevronRight size={13} /></Link>} /></div> : <div className="mt-7 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="dashboardSessionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.34} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#ffffff55", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={22} /><YAxis allowDecimals={false} tick={{ fill: "#ffffff55", fontSize: 10 }} tickLine={false} axisLine={false} width={28} /><Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} formatter={(value) => [`${Number(value)} sessions`, "Sessions"]} contentStyle={{ background: "#14132c", border: "1px solid #ffffff1c", borderRadius: 14, color: "white", fontSize: 12 }} labelStyle={{ color: "#ffffffaa", marginBottom: 4 }} /><Area type="monotone" dataKey="sessions" stroke="#a78bfa" strokeWidth={2.5} fill="url(#dashboardSessionFill)" activeDot={{ r: 4, fill: "#c4b5fd", stroke: "#181434", strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div>}
          </article>

          <article className="rounded-3xl border border-white/9 bg-[#10102d] p-5 sm:p-6"><SectionHeading eyebrow="Access health" title="Viewer links" action={<Link href={scoped("/watch-links")} className="text-xs font-medium text-violet-300 hover:text-violet-200">Manage <ArrowUpRight size={13} className="ml-1 inline" /></Link>} /><div className="mt-7 flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-200"><LockKeyhole size={23} /></div><div><p className="text-3xl font-semibold tracking-tight text-white">{linkHealth.active}</p><p className="text-sm text-white/42">active viewer links</p></div></div><div className="mt-7 space-y-3 text-xs"><div className="flex items-center justify-between"><span className="text-white/45">Videos with an active link</span><span className="font-medium text-white">{linkHealth.videosWithLinks} / {videos.length}</span></div><div className="flex items-center justify-between"><span className="text-white/45">Videos without a link</span><span className="font-medium text-white">{linkHealth.videosWithoutLinks}</span></div><div className="flex items-center justify-between"><span className="text-white/45">Revoked history</span><span className="font-medium text-white">{linkHealth.revoked}</span></div></div><div className="mt-7 flex items-start gap-3 border-t border-white/8 pt-5 text-xs leading-5 text-white/38"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-violet-300" /><span>One video supports one active TrackUp viewer link. Revoked links remain history.</span></div></article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <article className="rounded-3xl border border-white/9 bg-white/[0.03] p-5 sm:p-6"><SectionHeading eyebrow="Attention" title="Top videos" action={<Link href={scoped("/videos")} className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200">View library <ArrowUpRight size={13} /></Link>} /><p className="mt-2 text-xs text-white/35">Ranked by real viewer sessions in the selected range.</p>{topVideos.length === 0 ? <div className="mt-6"><EmptyState icon={PlayCircle} title="No videos have attention yet" body="Once a viewer opens a link, the most active videos will appear here." /></div> : <div className="mt-5 divide-y divide-white/7">{topVideos.map(({ video, sessions, viewers, measuredWatchTime, completion }, index) => <Link key={video.id} href={scopedVideo(`/videos/${video.id}`)} className="group grid grid-cols-[28px_48px_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[34px_56px_minmax(0,1fr)_auto] sm:gap-4"><span className="font-mono text-xs text-white/25">{String(index + 1).padStart(2, "0")}</span><VideoThumb video={video} compact /><span className="min-w-0"><span className="block truncate text-sm font-medium text-white/82 transition group-hover:text-violet-200">{video.title}</span><span className="mt-1 block truncate text-[11px] text-white/35">{formatProvider(video.source_type)} · {viewers} viewer{viewers === 1 ? "" : "s"}</span></span><span className="text-right"><span className="block text-sm font-semibold text-white">{sessions} session{sessions === 1 ? "" : "s"}</span><span className="mt-1 block text-[11px] text-white/35">{measuredWatchTime === null ? "Not measurable" : formatDuration(measuredWatchTime)}{completion === null ? "" : ` · ${completion}%`}</span></span></Link>)}</div>}</article>

          <article className="rounded-3xl border border-white/9 bg-white/[0.03] p-5 sm:p-6"><SectionHeading eyebrow="Live signal" title="Recent viewer activity" action={<Link href={scoped("/analytics")} className="text-xs font-medium text-violet-300 hover:text-violet-200">Details <ArrowUpRight size={13} className="ml-1 inline" /></Link>} /><p className="mt-2 text-xs text-white/35">Session activity and stored playback events only.</p>{recentActivity.length === 0 ? <div className="mt-6"><EmptyState icon={UsersRound} title="No viewer activity yet" body="Real session and playback activity will appear here after a viewer uses a TrackUp link." /></div> : <div className="mt-5 divide-y divide-white/7">{recentActivity.map((session) => <ActivityRow key={session.session_id} session={session} now={now} />)}</div>}</article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <article className="rounded-3xl border border-white/9 bg-white/[0.03] p-5 sm:p-6"><SectionHeading eyebrow="Library pulse" title="Latest videos" action={<Link href={scoped("/videos")} className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200">Full library <ArrowUpRight size={13} /></Link>} /><p className="mt-2 text-xs text-white/35">A compact view of the newest assets, not a duplicate library.</p>{recentVideos.length === 0 ? <div className="mt-6"><EmptyState icon={FileVideo} title="Your library is empty" body="Add a video to create your first TrackUp asset." action={canManage ? <Link href={scoped("/videos")} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-300"><Plus size={13} />Add video</Link> : undefined} /></div> : <div className="mt-5 divide-y divide-white/7">{recentVideos.map((video) => { const active = (video.watch_links ?? []).some((link) => isActiveLink(link, now)); return <Link key={video.id} href={scopedVideo(`/videos/${video.id}`)} className="group flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0"><VideoThumb video={video} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white/82 transition group-hover:text-violet-200">{video.title}</span><span className="mt-1 block truncate text-[11px] text-white/35">{formatProvider(video.source_type)} · {new Date(video.created_at).toLocaleDateString()}</span></span><span className="hidden text-right sm:block"><span className="block text-xs font-medium text-white/65">{video.view_count ?? 0} sessions</span><span className={`mt-1 block text-[10px] ${active ? "text-emerald-300/75" : "text-white/30"}`}>{active ? "Active link" : "No active link"}</span></span><ChevronRight size={15} className="shrink-0 text-white/20 transition group-hover:text-violet-300" /></Link>; })}</div>}</article>

          <article className="rounded-3xl border border-violet-300/12 bg-linear-to-br from-violet-500/[0.10] via-white/[0.035] to-blue-500/[0.08] p-5 sm:p-6"><SectionHeading eyebrow="Workspace tools" title="Quick actions" /><p className="mt-2 text-xs text-white/40">Move from overview to the next useful task.</p><div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{canManage && <QuickAction href={scoped("/videos")} icon={Plus} label="Add a video" detail="Build your library" tone="violet" />}<QuickAction href={scoped("/watch-links")} icon={Link2} label="Manage viewer links" detail="Share or revoke access" tone="blue" /><QuickAction href={scoped("/analytics")} icon={BarChart3} label="Open analytics" detail="Inspect real session data" tone="cyan" />{canManage && spaceId && scopeType !== "all" && <QuickAction href={scoped(`/spaces/${spaceId}/members`)} icon={UsersRound} label="Manage team" detail="Invitations and access" tone="emerald" />}</div></article>
        </section>
      </div>
    </div>
  );
}

function VideoThumb({ video, compact = false }: { video: Video; compact?: boolean }) {
  const provider = getProviderAdapter(video.source_type);
  const thumbnail = provider.thumbnail_url(video.source_url);
  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#171735] ${compact ? "h-11 w-14" : "h-12 w-16"}`}>{thumbnail ? <span aria-hidden="true" className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${thumbnail})` }} /> : <VideoIcon size={compact ? 15 : 17} className="text-white/25" />}{provider.source_type === "youtube" && <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1 py-0.5 text-[8px] font-semibold uppercase text-white/80">YT</span>}</span>;
}

function ActivityRow({ session, now }: { session: ViewerSessionAnalytics; now: number }) {
  const event = session.playback_events[session.playback_events.length - 1];
  const action = actionLabel(session);
  const viewerName = session.viewer_name?.trim() || session.viewer_email?.trim() || (session.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer");
  const viewerId = session.viewer_profile_id ?? session.viewer_identifier ?? "—";
  return <div className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${event ? "bg-violet-400/10 text-violet-200" : "bg-white/[0.05] text-white/35"}`}>{event ? <PlayCircle size={14} /> : <Eye size={14} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm text-white/78"><span className="font-medium text-white">{viewerName}</span> <span className="text-white/38">{action.toLowerCase()}</span></p><p className="mt-1 truncate text-[11px] text-white/35">{session.video_title} · {formatProvider(session.source_type)} · Session {session.session_number} · Viewer ID {viewerId}</p></div><span className="shrink-0 text-[10px] text-white/32">{formatRelative(session.last_activity_at, now)}</span></div>;
}

function QuickAction({ href, icon: Icon, label, detail, tone }: { href: string; icon: typeof Plus; label: string; detail: string; tone: Tone }) {
  const colors = toneClasses(tone);
  return <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-white/7 bg-black/10 p-3 transition hover:border-white/15 hover:bg-white/[0.07] active:scale-[0.99]"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white/80 transition group-hover:text-white">{label}</span><span className="mt-0.5 block truncate text-[11px] text-white/35">{detail}</span></span><ChevronRight size={14} className="shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60" /></Link>;
}
