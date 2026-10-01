"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSearch, RefreshCw, Search, ShieldAlert } from "lucide-react";

type AuditLevel = "INFO" | "WARN" | "ERROR";

type AuditLog = {
  id: string;
  created_at: string;
  level: AuditLevel;
  category: string;
  action: string;
  user_id: string | null;
  video_id: string | null;
  session_id: string | null;
  route: string | null;
  status: number | null;
  duration_ms: number | null;
  metadata: Record<string, string | number | boolean | null>;
};

type AuditLogsResponse = {
  logs?: AuditLog[];
  error?: string;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

function shortId(value: string): string {
  return `${value.slice(0, 8)}...`;
}

function targetFor(log: AuditLog): string {
  if (log.video_id) return `Video ${shortId(log.video_id)}`;
  if (log.session_id) return `Session ${shortId(log.session_id)}`;
  if (log.route) return log.route;
  return "Platform";
}

function levelClass(level: AuditLevel): string {
  if (level === "ERROR") return "border-red-300/25 bg-red-400/10 text-red-100";
  if (level === "WARN") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-sky-300/25 bg-sky-400/10 text-sky-100";
}

export default function AuditLogsConsole() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | AuditLevel>("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/owner/observability/logs?limit=100", { cache: "no-store" });
      const data: AuditLogsResponse = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "logs_unavailable");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "logs_unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const action = actionFilter.trim().toLowerCase();
    const actor = actorFilter.trim().toLowerCase();
    const target = targetFilter.trim().toLowerCase();
    const from = fromFilter ? new Date(`${fromFilter}T00:00:00`).getTime() : null;
    const to = toFilter ? new Date(`${toFilter}T23:59:59`).getTime() : null;
    return logs.filter((log) => {
      const createdAt = new Date(log.created_at).getTime();
      return (!action || log.action.toLowerCase().includes(action))
        && (!actor || (log.user_id ?? "").toLowerCase().includes(actor))
        && (!target || [log.video_id, log.session_id, log.route].some((value) => value?.toLowerCase().includes(target)))
        && (levelFilter === "all" || log.level === levelFilter)
        && (from === null || createdAt >= from)
        && (to === null || createdAt <= to);
    });
  }, [actionFilter, actorFilter, fromFilter, levelFilter, logs, targetFilter, toFilter]);

  return <section className="min-h-full bg-[#070720] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">Owner Console</p>
          <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Audit Logs</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Security and administrative activity across TrackUp. Only persisted, sanitized server records are shown.</p>
        </div>
        <button type="button" onClick={() => void loadLogs()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-violet-300/30 hover:text-white disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh logs</button>
      </header>

      {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-400/[0.08] px-4 py-3 text-xs leading-5 text-red-100"><ShieldAlert size={16} className="mt-0.5 shrink-0" />Audit logs are unavailable: {error}. No fallback records are shown.</div>}

      <section aria-label="Audit log filters" className="mt-6 grid gap-3 rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FilterInput label="Action" value={actionFilter} onChange={setActionFilter} placeholder="Filter action" />
        <FilterInput label="Actor" value={actorFilter} onChange={setActorFilter} placeholder="User ID" />
        <FilterInput label="Target" value={targetFilter} onChange={setTargetFilter} placeholder="Video, session, or route" />
        <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Severity<select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as "all" | AuditLevel)} className="mt-1.5 block min-h-10 w-full rounded-xl border border-white/10 bg-[#0b0b28] px-3 text-xs text-white outline-none focus:border-violet-300/45"><option value="all">All levels</option><option value="ERROR">Error</option><option value="WARN">Warning</option><option value="INFO">Info</option></select></label>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">From<input type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-xl border border-white/10 bg-[#0b0b28] px-3 text-xs text-white outline-none focus:border-violet-300/45" /></label>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">To<input type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-xl border border-white/10 bg-[#0b0b28] px-3 text-xs text-white outline-none focus:border-violet-300/45" /></label>
      </section>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><p className="text-sm font-semibold text-white">Recorded events</p><p className="mt-1 text-xs text-white/35">{filteredLogs.length} matching event{filteredLogs.length === 1 ? "" : "s"} from the latest 100 records.</p></div><FileSearch size={18} className="text-violet-300/70" /></div>
        {loading ? <div className="flex min-h-48 items-center justify-center text-sm text-white/45"><RefreshCw size={16} className="mr-2 animate-spin" />Loading persisted audit records...</div> : filteredLogs.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center"><Search size={20} className="text-white/20" /><p className="mt-3 text-sm text-white/50">No audit records match these filters.</p><p className="mt-1 text-xs text-white/30">Filters only search stored audit fields; no data is inferred.</p></div> : <div className="divide-y divide-white/7">{filteredLogs.map((log) => <article key={log.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold tracking-wide ${levelClass(log.level)}`}>{log.level}</span><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/65">{log.category}</span></div><p className="mt-2 truncate text-sm font-medium text-white/85" title={log.action}>{log.action}</p></div><dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><div className="min-w-0"><dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Actor</dt><dd className="mt-1 truncate text-white/60" title={log.user_id ?? undefined}>{log.user_id ? shortId(log.user_id) : "System"}</dd></div><div className="min-w-0"><dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Target</dt><dd className="mt-1 truncate text-white/60" title={targetFor(log)}>{targetFor(log)}</dd></div></dl><div className="text-left text-[10px] text-white/40 sm:text-right"><p>{formatDate(log.created_at)}</p><p className="mt-1">{log.status === null ? "No HTTP status" : `HTTP ${log.status}`}{log.duration_ms === null ? "" : ` · ${log.duration_ms}ms`}</p></div></article>)}</div>}
      </div>
    </div>
  </section>;
}

function FilterInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 block min-h-10 w-full rounded-xl border border-white/10 bg-[#0b0b28] px-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-violet-300/45" /></label>;
}
