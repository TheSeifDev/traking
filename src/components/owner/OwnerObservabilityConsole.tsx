"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import { HeatmapPanel, formatAnalyticsDate, formatAnalyticsDuration, formatAnalyticsPosition, telemetryClass, telemetryCopy } from "@/src/components/dashboard/AnalyticsDetail";
import GroupedSessionTimeline from "@/src/components/analytics/GroupedSessionTimeline";
import OwnerControlRoomPanel, { CONTROL_ROOM_NAV_GROUPS, type ControlRoomNavigationId } from "@/src/components/owner/OwnerControlRoomPanel";
import type { OwnerSessionDetail, OwnerSessionListItem } from "@/src/lib/observability/service";

type LiveState = "LIVE" | "RECONNECTING";

type ApiState = {
  sessions: OwnerSessionListItem[];
  sessionsTotal: number;
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

function badgeForState(state: string | undefined): string {
  return telemetryClass(state === "measured" || state === "unsupported" || state === "missing" ? state : "missing");
}

export default function OwnerObservabilityConsole() {
  const [section, setSection] = useState<ControlRoomNavigationId>("command");
  const [refreshKey, setRefreshKey] = useState(0);
  const [liveState, setLiveState] = useState<LiveState>("LIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ApiState>({ sessions: [], sessionsTotal: 0, selectedSession: null });
  const [sessionFilter, setSessionFilter] = useState("");
  const [inspectorLoading, setInspectorLoading] = useState(false);

  const loadSessions = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setLiveState("RECONNECTING");
    try {
      const sessionQuery = sessionFilter.trim() ? `&video_id=${encodeURIComponent(sessionFilter.trim())}` : "";
      const sessionsResponse = await readJson<{ sessions: OwnerSessionListItem[]; total: number }>(`/api/owner/observability/sessions?limit=100${sessionQuery}`);
      setState((current) => ({ ...current, sessions: sessionsResponse.sessions, sessionsTotal: sessionsResponse.total }));
      setError(null);
      setLiveState("LIVE");
    } catch (loadError) {
      setLiveState("RECONNECTING");
      setError(loadError instanceof Error ? loadError.message : "sessions_unavailable");
    } finally {
      if (!background) setLoading(false);
    }
  }, [sessionFilter]);

  const selectSection = (nextSection: ControlRoomNavigationId) => {
    setSection(nextSection);
    if (nextSection !== "sessions") setLiveState("LIVE");
  };

  useEffect(() => {
    if (section !== "sessions") return;
    const initialLoad = window.setTimeout(() => void loadSessions(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSessions(true);
    }, 12000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadSessions, section]);

  const refresh = () => {
    setRefreshKey((current) => current + 1);
    if (section === "sessions") void loadSessions();
  };

  const openInspector = async (sessionId: string) => {
    setInspectorLoading(true);
    try {
      const response = await readJson<{ session: OwnerSessionDetail }>(`/api/owner/observability/sessions/${encodeURIComponent(sessionId)}`);
      setState((current) => ({ ...current, selectedSession: response.session }));
      setError(null);
    } catch {
      setError("session_inspector_unavailable");
    } finally {
      setInspectorLoading(false);
    }
  };

  return (
    <section className="min-h-full bg-[#070720] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70"><span>Owner only</span><span className="text-white/20">/</span><span>Platform operations</span></div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">TrackUp Control Room</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">A single operational workspace for persisted platform, playback, security, and system evidence. Navigation, scope filters, and diagnostics stay separate so every view has one clear purpose.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold tracking-[0.16em] ${liveState === "LIVE" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}><span className={`h-1.5 w-1.5 rounded-full ${liveState === "LIVE" ? "bg-emerald-300" : "bg-amber-300"}`} />{liveState}</span>
            <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-violet-300/30 hover:text-white"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh current view</button>
          </div>
        </header>

        {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Some Control Room data is unavailable: {error}. No synthetic data is shown.</span></div>}

        <div className="mt-6 overflow-x-auto rounded-3xl border border-white/8 bg-white/[0.025]">
          <nav aria-label="Owner Control Room sections" className="flex min-w-max flex-wrap gap-3 p-3 sm:p-4">
            {CONTROL_ROOM_NAV_GROUPS.map((group) => <div key={group.label} className="flex items-center gap-1.5">
              <span className="px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">{group.label}</span>
              <div className="flex gap-1">{group.items.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => selectSection(id)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-[11px] font-medium transition ${section === id ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-300/15" : "text-white/45 hover:bg-white/5 hover:text-white"}`}><Icon size={14} className="shrink-0" />{label}</button>)}</div>
            </div>)}
          </nav>
        </div>

        <main className="mt-6 min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">{CONTROL_ROOM_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === section)?.label}</p><p className="mt-1 text-xs text-white/40">Scope and filters appear inside the selected operational view.</p></div><span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-white/35">Owner scope</span></div>
          {section === "sessions" ? <SessionsPanel sessions={state.sessions} total={state.sessionsTotal} filter={sessionFilter} setFilter={setSessionFilter} onApply={() => void loadSessions()} onOpen={openInspector} selected={state.selectedSession} inspectorLoading={inspectorLoading} loading={loading} /> : <OwnerControlRoomPanel key={`${section}-${refreshKey}`} initialSection={section} onSectionChange={selectSection} />}
        </main>
      </div>
    </section>
  );
}

function SessionsPanel({ sessions, total, filter, setFilter, onApply, onOpen, selected, inspectorLoading, loading }: { sessions: OwnerSessionListItem[]; total: number; filter: string; setFilter: (value: string) => void; onApply: () => void; onOpen: (id: string) => void; selected: OwnerSessionDetail | null; inspectorLoading: boolean; loading: boolean }) {
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]"><div className="min-w-0"><div className="mb-4 flex flex-col gap-3 rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Session inspector</p><h2 className="mt-2 text-xl font-semibold text-white">Real viewer activity</h2><p className="mt-1 text-xs text-white/40">{total} sessions in the bounded analytics window.</p></div><div className="flex w-full gap-2 sm:w-auto"><input aria-label="Filter sessions by video ID" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by video ID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-violet-300/40 sm:w-44" /><button type="button" onClick={onApply} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-violet-300/30 hover:text-white"><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Apply</button></div></div>{sessions.length === 0 ? <EmptyPanel title="No matching sessions" body="Only persisted sessions are shown. Unsupported or missing provider telemetry remains explicitly unavailable." /> : <div className="space-y-3">{sessions.map((session) => <button type="button" key={session.session_id} onClick={() => onOpen(session.session_id)} className={`block w-full min-w-0 rounded-2xl border p-4 text-left transition ${selected?.session_id === session.session_id ? "border-violet-300/35 bg-violet-400/[0.08]" : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white/85">{session.video_title}</p><p className="mt-1 truncate text-xs text-white/45">{displayViewer(session)} · session {shortId(session.session_id)}</p><p className="mt-2 text-[11px] text-white/30">Started {formatAnalyticsDate(session.started_at)} · Last activity {formatAnalyticsDate(session.last_activity_at)}</p></div><span className={`w-fit shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] ${badgeForState(session.telemetry_state)}`}>{telemetryCopy(session.telemetry_state)}</span></div><div className="mt-4 grid grid-cols-2 gap-2 min-[480px]:grid-cols-4"><SmallStat label="Events" value={String(session.telemetry_event_count)} /><SmallStat label="Watch time" value={formatAnalyticsDuration(session.watch_time_seconds)} /><SmallStat label="Completion" value={session.completion_percentage === null ? "Not measured" : `${session.completion_percentage}%`} /><SmallStat label="Last position" value={formatAnalyticsPosition(session.last_position)} /></div></button>)}</div>}</div><Inspector session={selected} loading={inspectorLoading} /></div>;
}

function Inspector({ session, loading }: { session: OwnerSessionDetail | null; loading: boolean }) {
  if (loading) return <aside className="flex min-h-56 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.03] text-xs text-white/40"><RefreshCw size={16} className="mr-2 animate-spin" />Loading session evidence…</aside>;
  if (!session) return <aside className="flex min-h-56 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-xs leading-5 text-white/35">Select a persisted session to inspect its ordered events, lifecycle, telemetry scope, and truthful heatmap state.</aside>;
  return <aside className="min-w-0 space-y-4"><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Selected session</p><h2 className="mt-2 truncate text-base font-semibold text-white">{session.video_title}</h2><p className="mt-1 truncate text-xs text-white/45">{displayViewer(session)} · {shortId(session.session_id)}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${badgeForState(session.telemetry_state)}`}>{telemetryCopy(session.telemetry_state)}</span></div><div className="mt-5 grid grid-cols-2 gap-2"><SmallStat label="Started" value={formatAnalyticsDate(session.started_at)} /><SmallStat label="First play" value={formatAnalyticsDate(session.first_play_at)} /><SmallStat label="Last activity" value={formatAnalyticsDate(session.last_activity_at)} /><SmallStat label="Ended" value={formatAnalyticsDate(session.ended_at)} /><SmallStat label="Watch time" value={formatAnalyticsDuration(session.watch_time_seconds)} /><SmallStat label="Last position" value={formatAnalyticsPosition(session.last_position)} /></div><p className="mt-4 text-[11px] leading-5 text-white/40">Measurement scope: <span className="text-white/65">{session.playback_metrics_scope}</span>. {session.has_playback_telemetry ? "Stored playback evidence is available." : "No reliable playback evidence is stored for this session."}</p></article><HeatmapPanel heatmap={session.heatmap} /><article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Stored event timeline</p><h2 className="mt-2 text-base font-semibold text-white">{session.playback_events.length} persisted events</h2></div><Activity size={17} className="text-violet-300" /></div><div className="mt-5"><GroupedSessionTimeline events={session.playback_events} /></div></article></aside>;
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/7 bg-black/10 p-2.5"><p className="truncate text-[9px] uppercase tracking-[0.12em] text-white/25">{label}</p><p className="mt-1 break-words text-xs font-semibold text-white/75">{value}</p></div>;
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center"><XCircle size={20} className="text-white/20" /><p className="mt-3 text-sm text-white/50">{title}</p><p className="mt-1 max-w-md text-xs leading-5 text-white/30">{body}</p></div>;
}
