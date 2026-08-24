"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, Database, Eye, FileWarning, RefreshCw, Server, ShieldCheck, Users, XCircle } from "lucide-react";
import type { WorkspaceAnalytics } from "@/src/types/video";
import { AnalyticsMetricGrid, HeatmapPanel, formatAnalyticsDate, formatAnalyticsDuration, formatAnalyticsPosition, telemetryClass, telemetryCopy } from "@/src/components/dashboard/AnalyticsDetail";
import GroupedSessionTimeline from "@/src/components/analytics/GroupedSessionTimeline";
import OwnerControlRoomPanel from "@/src/components/owner/OwnerControlRoomPanel";
import type { OwnerSessionDetail, OwnerSessionListItem } from "@/src/lib/observability/service";
import type { SafeOwnerLog, ObservabilityCategory, ObservabilityLevel } from "@/src/lib/observability/logger";

type LiveState = "LIVE" | "RECONNECTING";
type ControlRoomTab = "command" | "organizations" | "spaces" | "users" | "videos" | "activity" | "security" | "jobs" | "incidents";
type ConsoleTab = "overview" | "sessions" | "logs" | "system" | ControlRoomTab;

type OwnerRecentActivity = {
  session_id: string;
  viewer_profile_id: string | null;
  viewer_name: string | null;
  viewer_email: string | null;
  video_id: string;
  video_title: string;
  source_type: string;
  started_at: string;
  first_play_at: string | null;
  last_activity_at: string;
  ended_at: string | null;
  watch_time_seconds: number | null;
  completion_percentage: number | null;
  telemetry_state: "measured" | "missing" | "unsupported";
  telemetry_event_count: number;
};

type OwnerOverview = Omit<WorkspaceAnalytics, "viewer_sessions" | "recent_activity"> & { recent_activity: OwnerRecentActivity[] };
type SystemState = { checked_at: string; environment: string; deployment_sha: string | null; region: string | null; database: "connected" | "error"; database_status: "healthy" | "degraded"; database_latency_ms: number; database_error: "database_unavailable" | null };

type ApiState = {
  overview: OwnerOverview | null;
  logs: SafeOwnerLog[];
  sessions: OwnerSessionListItem[];
  sessionsTotal: number;
  system: SystemState | null;
  selectedSession: OwnerSessionDetail | null;
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data === "object" && data && "error" in data ? String(data.error) : "request_failed");
  return data as T;
}

function shortId(value: string | null | undefined): string {
  return value ? `${value.slice(0, 8)}…` : "—";
}

function displayViewer(session: { viewer_name?: string | null; viewer_email?: string | null; viewer_status?: string }): string {
  return session.viewer_name?.trim() || session.viewer_email?.trim() || (session.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer");
}

function isControlRoomTab(value: ConsoleTab): value is ControlRoomTab {
  return value === "command" || value === "organizations" || value === "spaces" || value === "users" || value === "videos" || value === "activity" || value === "security" || value === "jobs" || value === "incidents";
}

function badgeForState(state: string | undefined): string {
  return telemetryClass(state === "measured" || state === "unsupported" || state === "missing" ? state : "missing");
}

export default function OwnerObservabilityConsole() {
  const [tab, setTab] = useState<ConsoleTab>("command");
  const [liveState, setLiveState] = useState<LiveState>("RECONNECTING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ApiState>({ overview: null, logs: [], sessions: [], sessionsTotal: 0, system: null, selectedSession: null });
  const [sessionFilter, setSessionFilter] = useState("");
  const [logCategory, setLogCategory] = useState<ObservabilityCategory | "">("");
  const [logLevel, setLogLevel] = useState<ObservabilityLevel | "">("");
  const [inspectorLoading, setInspectorLoading] = useState(false);

  const loadConsole = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setLiveState("RECONNECTING");
    if (isControlRoomTab(tab)) {
      setLoading(false);
      setLiveState("LIVE");
      return;
    }
    try {
      const sessionQuery = sessionFilter.trim() ? `&video_id=${encodeURIComponent(sessionFilter.trim())}` : "";
      const logQuery = `${logCategory ? `&category=${encodeURIComponent(logCategory)}` : ""}${logLevel ? `&level=${encodeURIComponent(logLevel)}` : ""}`;
      const [overviewResponse, sessionsResponse, logsResponse, systemResponse] = await Promise.all([
        readJson<{ overview: OwnerOverview }>("/api/owner/observability/overview"),
        readJson<{ sessions: OwnerSessionListItem[]; total: number }>(`/api/owner/observability/sessions?limit=100${sessionQuery}`),
        readJson<{ logs: SafeOwnerLog[] }>(`/api/owner/observability/logs?limit=100${logQuery}`),
        readJson<{ system: SystemState }>("/api/owner/observability/system"),
      ]);
      setState((current) => ({ ...current, overview: overviewResponse.overview, sessions: sessionsResponse.sessions, sessionsTotal: sessionsResponse.total, logs: logsResponse.logs, system: systemResponse.system }));
      setError(null);
      setLiveState("LIVE");
    } catch (loadError) {
      setLiveState("RECONNECTING");
      setError(loadError instanceof Error ? loadError.message : "observability_unavailable");
    } finally {
      if (!background) setLoading(false);
    }
  }, [logCategory, logLevel, sessionFilter, tab]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadConsole(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadConsole(true);
    }, 12000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadConsole]);

  const openInspector = async (sessionId: string) => {
    setInspectorLoading(true);
    try {
      const response = await readJson<{ session: OwnerSessionDetail }>(`/api/owner/observability/sessions/${encodeURIComponent(sessionId)}`);
      setState((current) => ({ ...current, selectedSession: response.session }));
    } catch {
      setError("session_inspector_unavailable");
    } finally {
      setInspectorLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const overview = state.overview;
    if (!overview) return [];
    return [
      { label: "Total views", value: String(overview.total_views), note: "Persisted watch sessions in this workspace", icon: Eye },
      { label: "Unique viewers", value: String(overview.unique_viewers), note: "Profile-bound identities where available", icon: Users },
      { label: "Sessions", value: String(overview.total_sessions), note: "Created through the authenticated viewer flow", icon: Activity },
      { label: "Measurable watch time", value: formatAnalyticsDuration(overview.total_measurable_watch_time_seconds), note: "Only provider-supported telemetry", icon: Clock3 },
      { label: "Average watch time", value: formatAnalyticsDuration(overview.avg_watch_time_seconds), note: "Measured sessions only", icon: BarChart3 },
      { label: "Completion rate", value: overview.completion_rate === null ? "Not measured" : `${overview.completion_rate}%`, note: "Measured sessions reaching the completion threshold", icon: CheckCircle2 },
      { label: "Measured sessions", value: String(overview.telemetry_health?.measured_sessions ?? 0), note: "Ordered playback evidence available", icon: ShieldCheck },
      { label: "Unavailable sessions", value: String((overview.telemetry_health?.missing_sessions ?? 0) + (overview.telemetry_health?.unsupported_sessions ?? 0)), note: "Missing evidence or unsupported provider", icon: AlertTriangle },
    ];
  }, [state.overview]);

  const tabs: Array<{ id: ConsoleTab; label: string; icon: typeof Activity }> = [
    { id: "command", label: "Command Center", icon: BarChart3 },
    { id: "organizations", label: "Organizations", icon: Users },
    { id: "spaces", label: "Spaces", icon: Server },
    { id: "users", label: "Users", icon: Users },
    { id: "videos", label: "Videos", icon: Eye },
    { id: "sessions", label: "Sessions", icon: Activity },
    { id: "activity", label: "Activity / Audit", icon: FileWarning },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "jobs", label: "Jobs / Cron", icon: RefreshCw },
    { id: "incidents", label: "Incidents", icon: AlertTriangle },
    { id: "overview", label: "Legacy overview", icon: BarChart3 },
    { id: "logs", label: "Legacy logs", icon: FileWarning },
    { id: "system", label: "System detail", icon: Server },
  ];

  return (
    <section className="min-h-full bg-[#070720] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70"><span>Owner only</span><span className="text-white/20">/</span><span>Observability</span></div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">TrackUp control room</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">A truthful view of persisted authentication, tracking, analytics, provider, API, and database activity. No browser-console telemetry is used.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold tracking-[0.16em] ${liveState === "LIVE" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}><span className={`h-1.5 w-1.5 rounded-full ${liveState === "LIVE" ? "bg-emerald-300" : "bg-amber-300"}`} />{liveState}</span>
            <button type="button" onClick={() => void loadConsole()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-violet-300/30 hover:text-white"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
          </div>
        </header>

        {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Some observability data is unavailable: {error}. Core analytics is not replaced with synthetic data.</span></div>}

        <nav aria-label="Owner observability sections" className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.025] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition sm:px-4 ${tab === id ? "bg-violet-500/15 text-violet-200" : "text-white/45 hover:bg-white/5 hover:text-white"}`}><Icon size={15} />{label}</button>)}
        </nav>

        {loading && !state.overview && !isControlRoomTab(tab) ? <div className="mt-8 flex min-h-52 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.03] text-sm text-white/40"><RefreshCw size={18} className="mr-3 animate-spin" />Loading persisted observability…</div> : isControlRoomTab(tab) ? <OwnerControlRoomPanel initialSection={tab} /> : tab === "overview" ? <OverviewPanel overview={state.overview} metrics={metrics} /> : tab === "sessions" ? <SessionsPanel sessions={state.sessions} total={state.sessionsTotal} filter={sessionFilter} setFilter={setSessionFilter} onApply={() => void loadConsole()} onOpen={openInspector} selected={state.selectedSession} inspectorLoading={inspectorLoading} /> : tab === "logs" ? <LogsPanel logs={state.logs} category={logCategory} level={logLevel} setCategory={setLogCategory} setLevel={setLogLevel} onApply={() => void loadConsole()} /> : <SystemPanel system={state.system} />}
      </div>
    </section>
  );
}

function OverviewPanel({ overview, metrics }: { overview: OwnerOverview | null; metrics: Array<{ label: string; value: string; note: string; icon: typeof Eye }> }) {
  if (!overview) return <EmptyPanel title="No workspace overview" body="The owner overview could not be loaded from the persisted analytics service." />;
  return <div className="mt-8 space-y-6">
    <AnalyticsMetricGrid metrics={metrics} />
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <article className="min-w-0 rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Views over time</p><h2 className="mt-2 text-base font-semibold text-white">Persisted activity</h2></div><BarChart3 size={18} className="text-violet-300" /></div>
        {overview.activity_over_time.length === 0 ? <EmptyPanel title="No activity yet" body="Views will appear here after a real viewer session is persisted." compact /> : <div className="mt-6 space-y-3">{overview.activity_over_time.slice(-14).map((point) => <div key={point.date} className="flex items-center gap-3 text-xs"><span className="w-20 shrink-0 text-white/35">{point.date}</span><div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full bg-linear-to-r from-violet-500 to-cyan-300" style={{ width: `${Math.max(3, Math.min(100, point.views * 10))}%` }} /></div><span className="w-16 shrink-0 text-right text-white/55">{point.views} views</span></div>)}</div>}
      </article>
      <article className="min-w-0 rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Top videos</p><h2 className="mt-2 text-base font-semibold text-white">Where attention goes</h2></div><Eye size={18} className="text-cyan-300" /></div>{overview.top_videos_by_views.length === 0 ? <EmptyPanel title="No ranked videos" body="Video rankings use persisted watch sessions only." compact /> : <div className="mt-5 space-y-3">{overview.top_videos_by_views.slice(0, 5).map((video) => <div key={video.video_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/7 bg-black/10 px-3 py-3"><span className="min-w-0 truncate text-xs text-white/75">{video.title}</span><span className="shrink-0 text-xs font-semibold text-violet-200">{video.total_views}</span></div>)}</div>}</article>
    </div>
    <article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Recent activity</p><h2 className="mt-2 text-base font-semibold text-white">Latest persisted sessions</h2></div><Activity size={18} className="text-violet-300" /></div>{overview.recent_activity.length === 0 ? <EmptyPanel title="No sessions recorded" body="This view does not create sessions or telemetry on its own." compact /> : <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.recent_activity.slice(0, 9).map((session) => <div key={session.session_id} className="min-w-0 rounded-2xl border border-white/7 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-sm font-medium text-white/80">{session.video_title}</p><span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] ${badgeForState(session.telemetry_state)}`}>{telemetryCopy(session.telemetry_state)}</span></div><p className="mt-2 truncate text-xs text-white/45">{displayViewer(session)} · {shortId(session.session_id)}</p><p className="mt-3 text-[11px] text-white/35">Started {formatAnalyticsDate(session.started_at)}</p><p className="mt-1 text-[11px] text-white/45">{session.telemetry_event_count} events · {formatAnalyticsDuration(session.watch_time_seconds)}</p></div>)}</div>}</article>
  </div>;
}

function SessionsPanel({ sessions, total, filter, setFilter, onApply, onOpen, selected, inspectorLoading }: { sessions: OwnerSessionListItem[]; total: number; filter: string; setFilter: (value: string) => void; onApply: () => void; onOpen: (id: string) => void; selected: OwnerSessionDetail | null; inspectorLoading: boolean }) {
  return <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]"><div className="min-w-0"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Session inspector</p><h2 className="mt-2 text-xl font-semibold text-white">Real viewer activity</h2><p className="mt-1 text-xs text-white/40">{total} sessions in the bounded analytics window.</p></div><div className="flex gap-2"><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by video ID" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-violet-300/40 sm:w-44" /><button type="button" onClick={onApply} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-violet-300/30 hover:text-white">Apply</button></div></div>{sessions.length === 0 ? <EmptyPanel title="No matching sessions" body="Only persisted sessions are shown. Unsupported or missing provider telemetry remains explicitly unavailable." /> : <div className="space-y-3">{sessions.map((session) => <button type="button" key={session.session_id} onClick={() => onOpen(session.session_id)} className={`block w-full min-w-0 rounded-2xl border p-4 text-left transition ${selected?.session_id === session.session_id ? "border-violet-300/35 bg-violet-400/[0.08]" : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white/85">{session.video_title}</p><p className="mt-1 truncate text-xs text-white/45">{displayViewer(session)} · session {shortId(session.session_id)}</p><p className="mt-2 text-[11px] text-white/30">Started {formatAnalyticsDate(session.started_at)} · Last activity {formatAnalyticsDate(session.last_activity_at)}</p></div><span className={`w-fit shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] ${badgeForState(session.telemetry_state)}`}>{telemetryCopy(session.telemetry_state)}</span></div><div className="mt-4 grid grid-cols-2 gap-2 min-[480px]:grid-cols-4"><SmallStat label="Events" value={String(session.telemetry_event_count)} /><SmallStat label="Watch time" value={formatAnalyticsDuration(session.watch_time_seconds)} /><SmallStat label="Completion" value={session.completion_percentage === null ? "Not measured" : `${session.completion_percentage}%`} /><SmallStat label="Last position" value={formatAnalyticsPosition(session.last_position)} /></div></button>)}</div>}</div><Inspector session={selected} loading={inspectorLoading} /></div>;
}

function Inspector({ session, loading }: { session: OwnerSessionDetail | null; loading: boolean }) {
  if (loading) return <aside className="flex min-h-56 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.03] text-xs text-white/40"><RefreshCw size={16} className="mr-2 animate-spin" />Loading session evidence…</aside>;
  if (!session) return <aside className="flex min-h-56 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-xs leading-5 text-white/35">Select a persisted session to inspect its ordered events, lifecycle, telemetry scope, and truthful heatmap state.</aside>;
  return <aside className="min-w-0 space-y-4"><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Selected session</p><h2 className="mt-2 truncate text-base font-semibold text-white">{session.video_title}</h2><p className="mt-1 truncate text-xs text-white/45">{displayViewer(session)} · {shortId(session.session_id)}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${badgeForState(session.telemetry_state)}`}>{telemetryCopy(session.telemetry_state)}</span></div><div className="mt-5 grid grid-cols-2 gap-2"><SmallStat label="Started" value={formatAnalyticsDate(session.started_at)} /><SmallStat label="First play" value={formatAnalyticsDate(session.first_play_at)} /><SmallStat label="Last activity" value={formatAnalyticsDate(session.last_activity_at)} /><SmallStat label="Ended" value={formatAnalyticsDate(session.ended_at)} /><SmallStat label="Watch time" value={formatAnalyticsDuration(session.watch_time_seconds)} /><SmallStat label="Last position" value={formatAnalyticsPosition(session.last_position)} /></div><p className="mt-4 text-[11px] leading-5 text-white/40">Measurement scope: <span className="text-white/65">{session.playback_metrics_scope}</span>. {session.has_playback_telemetry ? "Stored playback evidence is available." : "No reliable playback evidence is stored for this session."}</p></article><HeatmapPanel heatmap={session.heatmap} /><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Stored event timeline</p><h2 className="mt-2 text-base font-semibold text-white">{session.playback_events.length} persisted events</h2></div><Activity size={17} className="text-violet-300" /></div><div className="mt-5"><GroupedSessionTimeline events={session.playback_events} /></div></article></aside>;
}

function LogsPanel({ logs, category, level, setCategory, setLevel, onApply }: { logs: SafeOwnerLog[]; category: ObservabilityCategory | ""; level: ObservabilityLevel | ""; setCategory: (value: ObservabilityCategory | "") => void; setLevel: (value: ObservabilityLevel | "") => void; onApply: () => void }) {
  return <div className="mt-8"><div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Structured activity</p><h2 className="mt-2 text-xl font-semibold text-white">Owner-visible logs</h2><p className="mt-1 text-xs text-white/40">Sanitized server records. Secrets, tokens, cookies, and raw headers are never displayed.</p></div><div className="flex flex-wrap gap-2"><select value={category} onChange={(event) => setCategory(event.target.value as ObservabilityCategory | "")} className="rounded-xl border border-white/10 bg-[#0b0b28] px-3 py-2 text-xs text-white/70 outline-none"><option value="">All categories</option>{["AUTH", "TRACKING", "SESSION", "VIDEO", "ANALYTICS", "API", "DATABASE", "SYSTEM", "PROVIDER", "SECURITY"].map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={level} onChange={(event) => setLevel(event.target.value as ObservabilityLevel | "")} className="rounded-xl border border-white/10 bg-[#0b0b28] px-3 py-2 text-xs text-white/70 outline-none"><option value="">All levels</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option></select><button type="button" onClick={onApply} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-violet-300/30 hover:text-white">Apply</button></div></div>{logs.length === 0 ? <EmptyPanel title="No structured logs available" body="Logs appear only when real server-side application activity reaches an instrumented path. This console never creates demo records." /> : <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03]"><div className="divide-y divide-white/7">{logs.map((log) => <div key={log.id} className="flex min-w-0 flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] ${log.level === "ERROR" ? "border-red-300/20 bg-red-400/10 text-red-200" : log.level === "WARN" ? "border-amber-300/20 bg-amber-400/10 text-amber-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"}`}>{log.level}</span><span className="text-[10px] uppercase tracking-wider text-violet-200/70">{log.category}</span><span className="text-xs font-medium text-white/80">{log.action}</span></div><p className="mt-2 break-all text-[11px] text-white/35">{log.route ?? "server"}{log.session_id ? ` · session ${shortId(log.session_id)}` : ""}{log.video_id ? ` · video ${shortId(log.video_id)}` : ""}</p></div><div className="shrink-0 text-left text-[10px] text-white/35 sm:text-right"><p>{formatAnalyticsDate(log.created_at)}</p><p className="mt-1">{log.status ?? "—"}{log.duration_ms === null ? "" : ` · ${log.duration_ms}ms`}</p></div></div>)}</div></div>}</div>;
}

function SystemPanel({ system }: { system: SystemState | null }) {
  if (!system) return <div className="mt-8"><EmptyPanel title="System state unavailable" body="The server-side system probe did not return a result." /></div>;
  const databaseLabel = system.database_status === "healthy" ? "Healthy" : "Degraded";
  const cards = [
    { label: "Database", value: databaseLabel, icon: Database },
    { label: "Latency", value: `${system.database_latency_ms}ms`, icon: Clock3 },
    { label: "Environment", value: system.environment, icon: Server },
    { label: "Deployment", value: system.deployment_sha ?? "Unavailable", icon: ShieldCheck },
    { label: "Region", value: system.region ?? "Unavailable", icon: Activity },
    { label: "Health cron", value: "Configured · not observed", icon: RefreshCw },
  ];
  return <div className="mt-8 space-y-6"><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"><Icon size={17} className={label === "Database" && system.database_status === "degraded" ? "text-amber-300" : "text-violet-300"} /><p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-white/30">{label}</p><p className="mt-2 break-all text-sm font-semibold text-white/80">{value}</p></article>)}</div><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><div className="flex items-start gap-3"><CheckCircle2 size={18} className={system.database_status === "healthy" ? "text-emerald-300" : "text-amber-300"} /><div><h2 className="text-base font-semibold text-white">Database {databaseLabel.toLowerCase()}</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-white/40">The Owner Console uses the same bounded, read-only Supabase probe as the internal health route. It never writes tracking, session, or analytics data. Health cron is configured as a once-daily native Vercel schedule, but execution is not observed in this console without trusted scheduler evidence. This panel does not claim a scheduled run.</p>{system.database_error && <p className="mt-3 text-[11px] text-amber-100">Database unavailable</p>}<p className="mt-3 text-[11px] text-white/30">Last checked {formatAnalyticsDate(system.checked_at)} · {system.database_latency_ms}ms</p></div></div></article></div>;
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/7 bg-black/10 p-2.5"><p className="truncate text-[9px] uppercase tracking-[0.12em] text-white/25">{label}</p><p className="mt-1 break-words text-xs font-semibold text-white/75">{value}</p></div>;
}

function EmptyPanel({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return <div className={`${compact ? "py-8" : "min-h-44 py-12"} flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center`}><XCircle size={20} className="text-white/20" /><p className="mt-3 text-sm text-white/50">{title}</p><p className="mt-1 max-w-md text-xs leading-5 text-white/30">{body}</p></div>;
}
