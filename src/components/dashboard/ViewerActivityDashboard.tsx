"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Filter,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AnalyticsComparison,
  CompletionDistributionBucket,
  ViewerActivityAnalytics,
  ViewerActivityKpi,
  ViewerActivityViewerRow,
} from "@/src/types/video";

const KPI_META: Record<ViewerActivityKpi["key"], { label: string; subtitle: string; color: string; icon: typeof Users }> = {
  unique_viewers: { label: "Unique viewers", subtitle: "Real viewer identities", color: "#a78bfa", icon: Users },
  sessions: { label: "Sessions", subtitle: "Real persisted visits", color: "#c084fc", icon: Eye },
  measured_watch_time: { label: "Measured watch time", subtitle: "Reliable playback only", color: "#38bdf8", icon: Clock3 },
  avg_watch_time: { label: "Avg watch time", subtitle: "Measured sessions only", color: "#34d399", icon: Activity },
  avg_completion: { label: "Avg completion", subtitle: "Measured sessions only", color: "#fbbf24", icon: TrendingUp },
  completion_rate: { label: "90%+ completion rate", subtitle: "Measured sessions reaching 90%+", color: "#fb7185", icon: CheckCircle2 },
};

const COMPLETION_COLORS: Record<CompletionDistributionBucket["key"], string> = {
  "90_plus": "#55d85a",
  "50_to_90": "#f59e0b",
  "10_to_50": "#f97316",
  "0_to_10": "#ef4444",
};

function formatDuration(value: number | null): string {
  if (value === null) return "Not measured";
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatInputDate(value: string): string {
  return value.slice(0, 10);
}

function displayViewer(viewer: ViewerActivityViewerRow): string {
  return viewer.viewer_name?.trim() || (viewer.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer");
}

function viewerIdentityLabel(viewer: ViewerActivityViewerRow): string {
  if (viewer.viewer_email) return viewer.viewer_email;
  if (viewer.viewer_status === "identified") return `Profile ${viewer.viewer_id.slice(0, 8)}`;
  return viewer.viewer_identifier ? `Legacy identity ${viewer.viewer_identifier.slice(0, 10)}` : "Legacy identity";
}

function formatKpiValue(kpi: ViewerActivityKpi): string {
  if (kpi.value === null) return "Not measured";
  if (kpi.key === "measured_watch_time" || kpi.key === "avg_watch_time") return formatDuration(kpi.value);
  if (kpi.key === "avg_completion" || kpi.key === "completion_rate") return `${Math.round(kpi.value)}%`;
  return Math.round(kpi.value).toLocaleString();
}

function Comparison({ comparison }: { comparison: AnalyticsComparison }) {
  if (!comparison.available || comparison.percentage === null) {
    return <span className="text-[10px] text-white/35">— No previous-period comparison</span>;
  }
  const positive = comparison.percentage >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 text-[10px] ${positive ? "text-emerald-300" : "text-rose-300"}`}><Icon size={11} />{Math.abs(comparison.percentage)}% vs previous period</span>;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-8 text-[10px] text-white/25">No trend data</div>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - min) / span) * 22}`).join(" ");
  return <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full overflow-visible" aria-label="Real period trend"><polyline points={points} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><polyline points={`0,31 ${points} 100,31`} fill={color} opacity=".08" stroke="none" /></svg>;
}

function KpiCard({ kpi }: { kpi: ViewerActivityKpi }) {
  const meta = KPI_META[kpi.key];
  const Icon = meta.icon;
  return <article className="min-w-0 rounded-2xl border border-white/10 bg-[#0d1026]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,.14)]"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}><Icon size={17} /></span><span className="text-[10px] text-white/30">Selected period</span></div><p className="mt-4 truncate text-[11px] font-medium text-white/55">{meta.label}</p><p className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">{formatKpiValue(kpi)}</p><div className="mt-2 min-h-4"><Comparison comparison={kpi.comparison} /></div><p className="mt-1 text-[10px] text-white/30">{meta.subtitle}</p><div className="mt-3"><Sparkline values={kpi.sparkline} color={meta.color} /></div></article>;
}

function CompletionDistribution({ buckets, measuredSessionCount }: { buckets: CompletionDistributionBucket[]; measuredSessionCount: number }) {
  let offset = 0;
  const stops = buckets.map((bucket) => {
    const start = offset;
    offset += bucket.percentage;
    return `${COMPLETION_COLORS[bucket.key]} ${start}% ${offset}%`;
  });
  const background = measuredSessionCount > 0 ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#ffffff12 0 100%)";
  return <article className="rounded-2xl border border-white/10 bg-[#0d1026]/90 p-5"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold text-white">Completion distribution</h2><p className="mt-1 text-xs text-white/40">Across all measured sessions</p></div><CheckCircle2 size={17} className="text-rose-300" /></div><div className="mt-7 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center"><div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background }}><div className="absolute inset-[25%] flex flex-col items-center justify-center rounded-full bg-[#0d1026] text-center"><strong className="text-2xl font-semibold text-white">{measuredSessionCount}</strong><span className="text-[10px] text-white/45">Measured sessions</span></div></div><div className="w-full max-w-[220px] space-y-3">{buckets.map((bucket) => <div key={bucket.key} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-white/60"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COMPLETION_COLORS[bucket.key] }} />{bucket.label}</span><strong className="text-white">{bucket.count} ({bucket.percentage}%)</strong></div>)}{measuredSessionCount === 0 && <p className="text-[11px] leading-5 text-white/35">No reliable completion data exists in this period.</p>}</div></div></article>;
}

function SessionsChart({ points }: { points: ViewerActivityAnalytics["sessions_over_time"] }) {
  const chartData = points.map((point) => ({ ...point, label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  return <article className="rounded-2xl border border-white/10 bg-[#0d1026]/90 p-5"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold text-white">Viewer sessions over time</h2><p className="mt-1 text-xs text-white/40">Sessions started by day</p></div><select defaultValue="daily" className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white/65 outline-none"><option value="daily">Daily</option></select></div><div className="mt-5 h-64">{chartData.length === 0 ? <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-white/35">No session history in this period.</div> : <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -16 }}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#ffffff66", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#ffffff66", fontSize: 10 }} tickLine={false} axisLine={false} width={30} /><Tooltip contentStyle={{ background: "#14132b", border: "1px solid #ffffff1c", borderRadius: 12, color: "white" }} labelStyle={{ color: "#ffffffaa" }} /><Bar dataKey="sessions" fill="#7c3aed" radius={[5, 5, 0, 0]} maxBarSize={28} /><Line type="monotone" dataKey="unique_viewers" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: "#c4b5fd", stroke: "#171332", strokeWidth: 2 }} /></ComposedChart></ResponsiveContainer>}</div><div className="mt-3 flex items-center justify-center gap-5 text-[10px] text-white/45"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-violet-500" />Sessions</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-violet-300" />Unique viewers</span></div></article>;
}

function TelemetryBadge({ state }: { state: ViewerActivityViewerRow["telemetry_state"] }) {
  const measured = state === "measured";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] ${measured ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/45"}`}>{measured ? "Measured" : state === "unsupported" ? "Session only" : "Not measured"}</span>;
}

function ProgressCell({ viewer }: { viewer: ViewerActivityViewerRow }) {
  if (viewer.progress_percentage === null) return <span className="text-xs text-white/35">Unavailable</span>;
  return <div className="min-w-[120px]"><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, viewer.progress_percentage))}%` }} /></div><span className="text-xs font-medium text-white">{viewer.progress_percentage}%</span></div><p className="mt-1 text-[10px] text-white/30">Measured coverage</p></div>;
}

function ViewerDesktopTable({ viewers, scopeQuery }: { viewers: ViewerActivityViewerRow[]; scopeQuery: string }) {
  return <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] border-collapse text-left"><thead><tr className="border-b border-white/8 text-[10px] uppercase tracking-[0.12em] text-white/35"><th className="px-4 py-3 font-medium">Viewer</th><th className="px-3 py-3 font-medium">Sessions</th><th className="px-3 py-3 font-medium">Videos</th><th className="px-3 py-3 font-medium">Measured watch time</th><th className="px-3 py-3 font-medium">Avg watch time</th><th className="px-3 py-3 font-medium">Completion</th><th className="px-3 py-3 font-medium">Last seen</th><th className="px-3 py-3 font-medium">Progress</th><th className="px-4 py-3 text-right font-medium">Action</th></tr></thead><tbody>{viewers.map((viewer) => <tr key={viewer.viewer_id} className="border-b border-white/6 transition hover:bg-white/[0.025]"><td className="px-4 py-3"><div className="flex min-w-[210px] items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-500/80 to-indigo-700 text-xs font-semibold text-white">{displayViewer(viewer).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{displayViewer(viewer)}</p><p className="truncate text-[11px] text-white/35">{viewerIdentityLabel(viewer)}</p><div className="mt-1"><TelemetryBadge state={viewer.telemetry_state} /></div></div></div></td><td className="px-3 py-3 text-sm text-white">{viewer.total_sessions}</td><td className="px-3 py-3 text-sm text-white">{viewer.videos_watched}</td><td className="px-3 py-3 text-sm text-white">{viewer.total_watch_time_seconds === null ? <span className="text-white/35">—<span className="ml-1 text-[10px]">Not measured</span></span> : formatDuration(viewer.total_watch_time_seconds)}</td><td className="px-3 py-3 text-sm text-white">{viewer.avg_watch_time_seconds === null ? <span className="text-white/35">—</span> : formatDuration(viewer.avg_watch_time_seconds)}</td><td className="px-3 py-3 text-sm text-white">{viewer.avg_completion_percentage === null ? <span className="text-white/35">—</span> : `${viewer.avg_completion_percentage}%`}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-white/60">{formatDateTime(viewer.last_seen_at)}</td><td className="px-3 py-3"><ProgressCell viewer={viewer} /></td><td className="px-4 py-3 text-right"><Link href={`/analytics/viewers/${encodeURIComponent(viewer.viewer_id)}${scopeQuery}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-violet-300/25 px-3 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-300/50 hover:bg-violet-400/10">View viewer <ChevronRight size={13} /></Link></td></tr>)}</tbody></table></div>;
}

function ViewerMobileCards({ viewers, scopeQuery }: { viewers: ViewerActivityViewerRow[]; scopeQuery: string }) {
  return <div className="space-y-3 p-3 md:hidden">{viewers.map((viewer) => <article key={viewer.viewer_id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-500/80 to-indigo-700 text-xs font-semibold text-white">{displayViewer(viewer).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{displayViewer(viewer)}</p><p className="truncate text-[11px] text-white/35">{viewerIdentityLabel(viewer)}</p></div></div><TelemetryBadge state={viewer.telemetry_state} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Metric label="Sessions" value={String(viewer.total_sessions)} /><Metric label="Videos" value={String(viewer.videos_watched)} /><Metric label="Watch time" value={viewer.total_watch_time_seconds === null ? "Not measured" : formatDuration(viewer.total_watch_time_seconds)} /><Metric label="Completion" value={viewer.avg_completion_percentage === null ? "Not measured" : `${viewer.avg_completion_percentage}%`} /><Metric label="Last seen" value={formatDate(viewer.last_seen_at)} /></div><div className="mt-4"><ProgressCell viewer={viewer} /></div><Link href={`/analytics/viewers/${encodeURIComponent(viewer.viewer_id)}${scopeQuery}`} className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-violet-300/25 px-3 py-2 text-xs font-medium text-violet-200">View viewer <ChevronRight size={13} /></Link></article>)}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-wide text-white/30">{label}</p><p className="mt-1 truncate text-sm font-medium text-white">{value}</p></div>;
}

export default function ViewerActivityDashboard({ analytics, scopeQuery, contextLabel }: { analytics: ViewerActivityAnalytics; scopeQuery: string; contextLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(analytics.filters.search);
  const [fromDate, setFromDate] = useState(formatInputDate(analytics.filters.from));
  const [toDate, setToDate] = useState(formatInputDate(analytics.filters.to));
  const [status, setStatus] = useState(analytics.filters.status);
  const [minimumSessions, setMinimumSessions] = useState(String(analytics.filters.minimum_sessions));


  const scopeParams = useMemo(() => new URLSearchParams(scopeQuery.replace(/^\?/, "")), [scopeQuery]);
  const applyQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(scopeParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const exportHref = useMemo(() => {
    const params = new URLSearchParams(scopeParams);
    params.set("from", analytics.filters.from);
    params.set("to", analytics.filters.to);
    if (analytics.filters.search) params.set("search", analytics.filters.search);
    if (analytics.filters.status !== "all") params.set("status", analytics.filters.status);
    if (analytics.filters.minimum_sessions > 1) params.set("minimum_sessions", String(analytics.filters.minimum_sessions));
    return `/api/analytics/viewer-activity/export?${params.toString()}`;
  }, [analytics.filters, scopeParams]);

  const activeFilterCount = [analytics.filters.search, analytics.filters.status !== "all" ? analytics.filters.status : "", analytics.filters.minimum_sessions > 1 ? String(analytics.filters.minimum_sessions) : ""].filter(Boolean).length;
  const page = analytics.filters.page;
  const totalPages = Math.max(1, Math.ceil(analytics.total_viewer_rows / analytics.filters.page_size));

  return <main className="min-h-full bg-[#07091b] px-4 py-5 sm:px-6 lg:px-8 lg:py-7"><div className="mx-auto max-w-[1480px] space-y-5">
    <header className="flex flex-col gap-5 border-b border-white/8 pb-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-violet-300/80">{contextLabel} / viewer analytics</p><div className="mt-2 flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Viewer activity</h1><Users size={19} className="text-violet-300" /></div><p className="mt-2 text-sm text-white/45">Real watch sessions grouped by viewer identity with progress and performance insights.</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/65"><CalendarDays size={14} />{formatDate(analytics.filters.from)} – {formatDate(new Date(new Date(analytics.filters.to).getTime() - 1).toISOString())}<ChevronDown size={13} className="text-white/35" /></div><div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/65"><Users size={14} />All video viewers<ChevronDown size={13} className="text-white/35" /></div><a href={exportHref} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500"><Download size={14} />Export report</a></div></header>

    <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{analytics.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}</section>

    <section className="rounded-2xl border border-white/10 bg-[#0b0e22]/90 p-3"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><form className="relative min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); applyQuery({ search, page: "1" }); }}><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search viewers, email, session, video, or provider..." className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-300/45" /></form><div className="flex flex-wrap gap-2"><label className="relative inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55"><Filter size={14} /><span>Status</span><select value={status} onChange={(event) => { const value = event.target.value as typeof status; setStatus(value); applyQuery({ status: value === "all" ? null : value, page: "1" }); }} className="appearance-none bg-transparent pr-4 text-white outline-none"><option value="all">All status</option><option value="measured">Measured</option><option value="unmeasured">Unmeasured</option></select><ChevronDown size={12} className="pointer-events-none absolute right-2 text-white/35" /></label><label className="relative inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55"><Users size={14} /><span>Minimum sessions</span><select value={minimumSessions} onChange={(event) => { setMinimumSessions(event.target.value); applyQuery({ minimum_sessions: event.target.value === "1" ? null : event.target.value, page: "1" }); }} className="appearance-none bg-transparent pr-4 text-white outline-none"><option value="1">All</option><option value="2">2+</option><option value="3">3+</option><option value="5">5+</option><option value="10">10+</option></select><ChevronDown size={12} className="pointer-events-none absolute right-2 text-white/35" /></label><button type="button" onClick={() => { setSearch(""); setStatus("all"); setMinimumSessions("1"); applyQuery({ search: null, status: null, minimum_sessions: null, page: "1" }); }} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:border-white/25 hover:text-white">Clear{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</button></div></div><div className="mt-3 flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row sm:items-center"><span className="text-[10px] uppercase tracking-[0.14em] text-white/30">Date range</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white outline-none" /><span className="text-xs text-white/30">to</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white outline-none" /><button type="button" onClick={() => { if (fromDate && toDate && fromDate < toDate) applyQuery({ from: `${fromDate}T00:00:00.000Z`, to: `${toDate}T23:59:59.999Z`, page: "1" }); }} className="rounded-lg bg-white/8 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/15">Apply period</button><span className="text-[11px] text-white/30">{analytics.total_sessions} sessions · {analytics.total_viewers} viewers in this filtered view</span></div></section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]"><SessionsChart points={analytics.sessions_over_time} /><CompletionDistribution buckets={analytics.completion_distribution} measuredSessionCount={analytics.measured_session_count} /></section>

    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e22]/90"><div className="flex flex-col gap-1 border-b border-white/8 px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Viewer directory ({analytics.total_viewer_rows})</h2><p className="mt-1 text-xs text-white/40">One row per real viewer identity in this scope. Progress means average measured completion across this viewer&apos;s measured sessions.</p></div><span className="text-[10px] text-white/30">{analytics.total_viewer_rows === 0 ? "No viewers found" : `Showing ${Math.min((page - 1) * analytics.filters.page_size + 1, analytics.total_viewer_rows)}–${Math.min(page * analytics.filters.page_size, analytics.total_viewer_rows)} of ${analytics.total_viewer_rows}`}</span></div></div>{analytics.viewers.length === 0 ? <div className="px-6 py-16 text-center"><Users size={28} className="mx-auto text-white/20" /><h3 className="mt-3 text-sm font-medium text-white">{activeFilterCount > 0 ? "No viewers match filters" : "No viewers found"}</h3><p className="mt-2 text-xs text-white/35">Try clearing filters or choose a period with persisted sessions.</p></div> : <><ViewerDesktopTable viewers={analytics.viewers} scopeQuery={scopeQuery} /><ViewerMobileCards viewers={analytics.viewers} scopeQuery={scopeQuery} /></>}<div className="flex items-center justify-between border-t border-white/8 px-4 py-3 text-xs text-white/35"><span>Page {page} of {totalPages}</span><div className="flex items-center gap-1"><button type="button" disabled={page <= 1} onClick={() => applyQuery({ page: String(page - 1) })} className="rounded-lg border border-white/8 p-2 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft size={14} /></button><span className="rounded-lg bg-violet-600 px-3 py-2 font-medium text-white">{page}</span><button type="button" disabled={!analytics.has_more_viewers} onClick={() => applyQuery({ page: String(page + 1) })} className="rounded-lg border border-white/8 p-2 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={14} /></button></div></div></section>
  </div></main>;
}
