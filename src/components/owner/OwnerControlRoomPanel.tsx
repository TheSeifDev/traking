"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Building2, Clock3, ExternalLink, Eye, FileSearch, RefreshCw, Search, Server, ShieldAlert, Users, Video, Zap } from "lucide-react";
import type { ControlRoomData } from "@/src/lib/observability/control-room";
import { getSafeSpaceDisplayName, hasOrganizationSpaceLabelCollision, isSelectableChildSpace } from "@/src/lib/spaces/labels";

export type ControlRoomSection = "command" | "organizations" | "spaces" | "users" | "videos" | "playback" | "activity" | "security" | "jobs" | "health" | "api" | "database" | "incidents" | "flags" | "configuration";

function isControlRoomData(value: unknown): value is ControlRoomData {
  if (typeof value !== "object" || value === null) return false;
  if (!("generated_at" in value) || !("range" in value) || !("metrics" in value) || !("organizations" in value) || !("spaces" in value) || !("users" in value) || !("videos" in value) || !("recent_activity" in value) || !("security" in value) || !("jobs" in value) || !("incidents" in value)) return false;
  const metrics = value.metrics;
  return typeof metrics === "object" && metrics !== null && Array.isArray(value.organizations) && Array.isArray(value.spaces) && Array.isArray(value.users) && Array.isArray(value.videos) && Array.isArray(value.recent_activity) && Array.isArray(value.incidents);
}

export type ControlRoomNavigationId = ControlRoomSection | "sessions";

type NavigationItem = { id: ControlRoomNavigationId; label: string; icon: typeof Activity };

export const CONTROL_ROOM_NAV_GROUPS: Array<{ label: string; items: NavigationItem[] }> = [
  { label: "Operations", items: [
    { id: "command", label: "Command Center", icon: BarChart3 },
    { id: "organizations", label: "Organizations", icon: Building2 },
    { id: "spaces", label: "Spaces", icon: Server },
    { id: "users", label: "Users", icon: Users },
    { id: "videos", label: "Videos", icon: Video },
  ] },
  { label: "Observability", items: [
    { id: "playback", label: "Playback Intelligence", icon: Activity },
    { id: "sessions", label: "Sessions", icon: Eye },
    { id: "activity", label: "Activity / Audit", icon: FileSearch },
    { id: "incidents", label: "Incidents", icon: AlertTriangle },
  ] },
  { label: "Platform", items: [
    { id: "security", label: "Security", icon: ShieldAlert },
    { id: "health", label: "System Health", icon: Clock3 },
    { id: "api", label: "API / Provider", icon: ExternalLink },
    { id: "jobs", label: "Jobs / Cron", icon: RefreshCw },
  ] },
  { label: "System", items: [
    { id: "database", label: "Database", icon: Server },
    { id: "flags", label: "Feature Flags", icon: Zap },
    { id: "configuration", label: "Configuration", icon: FileSearch },
  ] },
];

function formatSeconds(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "No evidence";
}

function relative(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function statusClass(status: string): string {
  if (status === "active" || status === "ok" || status === "INFO" || status === "success" || status === "succeeded" || status === "healthy" || status === "observed") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  if (status === "archived" || status === "warning" || status === "MEDIUM" || status === "LOW") return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  return "border-red-300/20 bg-red-400/10 text-red-200";
}

export default function OwnerControlRoomPanel({ initialSection = "command", onSectionChange }: { initialSection?: ControlRoomSection; onSectionChange?: (section: ControlRoomSection) => void }) {
  const [section, setSection] = useState<ControlRoomSection>(initialSection);
  const navigateToSection = onSectionChange ?? setSection;
  const [range, setRange] = useState("7d");
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [data, setData] = useState<ControlRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ range });
    if (query.trim()) params.set("q", query.trim());
    if (provider) params.set("provider", provider);
    if (organizationId) params.set("organization_id", organizationId);
    if (spaceId) params.set("space_id", spaceId);
    try {
      const response = await fetch(`/api/owner/control-room?${params.toString()}`, { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || typeof payload !== "object" || payload === null || !("data" in payload) || !isControlRoomData(payload.data)) throw new Error("control_room_unavailable");
      setData(payload.data);
      if (!organizationId && payload.data.organizations[0]) setOrganizationId(payload.data.organizations[0].id);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "control_room_unavailable");
    } finally {
      setLoading(false);
    }
  }, [organizationId, provider, query, range, spaceId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("keydown", onShortcut);
    };
  }, [load]);

  const selectedOrganization = data?.organizations.find((organization) => organization.id === organizationId);
  const filteredSpaces = useMemo(() => data?.spaces.filter((space) => (!organizationId || space.organization_id === organizationId) && isSelectableChildSpace(space, space.organization_name)) ?? [], [data, organizationId]);
  const metrics = data ? [
    ["Organizations", data.metrics.total_organizations, `${data.metrics.active_organizations} active`, Building2],
    ["Spaces", data.metrics.total_spaces, `${data.metrics.active_spaces} active`, Server],
    ["Users", data.metrics.total_users, `${data.metrics.active_users} active`, Users],
    ["Videos", data.metrics.total_videos, "Space-scoped resources", Video],
    ["Active links", data.metrics.active_watch_links, "Not revoked or expired", ExternalLink],
    ["Sessions", data.metrics.total_sessions, `${data.metrics.sessions_today} today · ${data.metrics.measured_sessions} measured`, Activity],
    ["Views / 7d", data.metrics.views_last_7_days, `${data.metrics.views_today} today · ${data.comparison.views_delta_percentage === null ? "no prior period" : `${data.comparison.views_delta_percentage}% vs prior`}`, BarChart3],
    ["Measured watch", formatSeconds(data.metrics.measured_watch_time_seconds), data.metrics.measured_watch_time_seconds === null ? "No reliable evidence" : "Persisted session time", Clock3],
    ["Active viewers", data.metrics.active_viewers, "Seen in the last 15 minutes", Zap],
    ["Failed sessions", data.metrics.failed_sessions, "Observed server-side failures", AlertTriangle],
    ["Provider errors", data.metrics.provider_errors, "Persisted provider warnings/errors", ShieldAlert],
  ] as const : [];

  return <section className="mt-6 space-y-5">
    <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex flex-col gap-1"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Scope and filters</p><p className="text-xs text-white/40">Control Room defaults to the first authorized Organization, All Spaces, Last 7 days, and all providers.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_auto_auto_auto_auto]">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/8 bg-black/10 px-3 py-2"><Search size={15} className="shrink-0 text-white/30" /><input ref={searchRef} aria-label="Control Room global search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} placeholder="Search users, spaces, videos, sessions, or logs" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/25" /></div>
        <select aria-label="Control Room period" value={range} onChange={(event) => setRange(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-[#0b0b28] px-3 py-2 text-xs text-white/70"><option value="1h">Last 1 hour</option><option value="24h">Last 24 hours</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All persisted time</option></select>
        <select aria-label="Control Room Organization" value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setSpaceId(""); }} className="min-h-10 min-w-0 rounded-xl border border-white/10 bg-[#0b0b28] px-3 py-2 text-xs text-white/70"><option value="">All Organizations</option>{data?.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>
        <select aria-label="Control Room Space" value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className="min-h-10 min-w-0 rounded-xl border border-white/10 bg-[#0b0b28] px-3 py-2 text-xs text-white/70"><option value="">All Spaces</option>{filteredSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select>
        <div className="flex min-w-0 gap-2"><select aria-label="Control Room provider" value={provider} onChange={(event) => setProvider(event.target.value)} className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b0b28] px-3 py-2 text-xs text-white/70"><option value="">All providers</option><option value="youtube">YouTube</option><option value="google_drive">Google Drive</option><option value="telegram">Telegram</option><option value="direct_url">Direct URL</option></select><button type="button" onClick={() => void load()} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:border-violet-300/30 hover:text-white"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /><span className="sr-only sm:not-sr-only">Refresh</span></button></div>
      </div>
    </div>
    {error && <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"><AlertTriangle size={15} />{error}. No synthetic fallback data is shown.</div>}
    {loading && !data ? <div className="flex min-h-52 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.03] text-xs text-white/40"><RefreshCw size={16} className="mr-2 animate-spin" />Loading bounded persisted Control Room data…</div> : data ? <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-white/35"><span>Scope: {selectedOrganization?.name ?? "All Organizations"}{spaceId ? ` · ${data.spaces.find((space) => space.id === spaceId)?.name ?? "Space"}` : ""} · {data.range}</span><span>Last updated {relative(data.generated_at)} · server window starts {formatDate(data.range_start)}</span></div>
      {section === "command" && <CommandCenter data={data} metrics={metrics} setSection={navigateToSection} />}
      {section === "organizations" && <OrganizationsPanel data={data} />}
      {section === "spaces" && <SpacesPanel data={data} />}
      {section === "users" && <UsersPanel data={data} />}
      {section === "videos" && <VideosPanel data={data} />}
      {section === "playback" && <PlaybackPanel data={data} />}
      {section === "activity" && <ActivityPanel data={data} />}
      {section === "security" && <SecurityPanel data={data} />}
      {section === "jobs" && <JobsPanel data={data} />}
      {section === "health" && <SystemHealthPanel />}
      {section === "api" && <ProviderHealthPanel data={data} />}
      {section === "database" && <SystemHealthPanel databaseOnly />}
      {section === "incidents" && <IncidentsPanel data={data} />}
      {section === "flags" && <UnavailablePanel title="Feature flags" body="No persisted feature-flag registry is configured in the current TrackUp architecture. No inferred flags are shown." />}
      {section === "configuration" && <UnavailablePanel title="Configuration" body="Secrets and private runtime configuration are intentionally not exposed in the Owner Console. Only safe deployment and health metadata are shown in System Health." />}
    </> : null}
  </section>;
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) { return <article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">{eyebrow}</p><h2 className="mt-2 text-base font-semibold text-white">{title}</h2></div><FileSearch size={17} className="text-violet-300" /></div>{children}</article>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-xs text-white/35">{text}</div>; }
function SyncAction({ organizationId }: { organizationId: string }) {
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (mode: "preview" | "apply") => {
    if (mode === "apply" && !window.confirm("Apply the provider-backed ClickUp Space mapping? Existing legacy rows will not be deleted and absent members will not be suspended.")) return;
    setBusy(mode);
    setMessage(null);
    try {
      const response = await fetch("/api/owner/clickup/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: organizationId, mode }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "clickup_sync_unavailable");
      const summary = payload && typeof payload === "object" && "summary" in payload ? "Sync apply completed from persisted provider evidence." : "Read-only preview loaded. Review the proposed mapping before apply.";
      setMessage(summary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "clickup_sync_unavailable");
    } finally {
      setBusy(null);
    }
  };
  return <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/7 pt-4"><span className="mr-1 text-[10px] text-white/35">ClickUp hierarchy</span><button type="button" disabled={busy !== null} onClick={() => void run("preview")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/65 hover:border-violet-300/30 hover:text-white disabled:opacity-40">{busy === "preview" ? "Previewing…" : "Preview sync"}</button><button type="button" disabled={busy !== null} onClick={() => void run("apply")} className="rounded-lg border border-violet-300/25 bg-violet-400/10 px-2.5 py-1.5 text-[10px] text-violet-100 hover:bg-violet-400/20 disabled:opacity-40">{busy === "apply" ? "Applying…" : "Apply sync"}</button>{message && <span className="text-[10px] text-amber-100/75">{message}</span>}</div>;
}
function CommandCenter({ data, metrics, setSection }: { data: ControlRoomData; metrics: readonly (readonly [string, string | number, string, typeof Building2])[]; setSection: (section: ControlRoomSection) => void }) { return <div className="space-y-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{metrics.map(([label, value, note, Icon]) => <article key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"><Icon size={16} className="text-violet-300" /><p className="mt-4 text-[9px] uppercase tracking-[0.15em] text-white/30">{label}</p><p className="mt-2 break-words text-xl font-semibold text-white">{value}</p><p className="mt-1 text-[10px] leading-4 text-white/35">{note}</p></article>)}</div><div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><Panel title="Platform activity" eyebrow="Persisted operational feed"><ActivityList data={data} limit={12} /></Panel><Panel title="Observed incidents" eyebrow="Evidence-based only"><IncidentList data={data} limit={6} onOpen={() => setSection("incidents")} /></Panel></div><Panel title="Top videos by persisted sessions" eyebrow="Playback intelligence"><VideoTable videos={data.videos.slice(0, 8)} /></Panel></div>; }
function OrganizationsPanel({ data }: { data: ControlRoomData }) { return <Panel title="Organization explorer" eyebrow="Platform → Organization → Spaces"><div className="space-y-3">{data.organizations.length === 0 ? <Empty text="No Organizations found in the current scope." /> : data.organizations.map((organization) => <div key={organization.id} className="rounded-2xl border border-white/8 bg-black/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold text-white/85">{organization.name}</p><p className="mt-1 text-[11px] text-white/35">{organization.slug} · {organization.clickup_workspace_id ? "ClickUp Workspace linked" : "ClickUp Workspace not linked"}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] ${statusClass(organization.status)}`}>{organization.status}</span><span className={`rounded-full border px-2 py-1 text-[9px] ${statusClass(organization.clickup_sync_status)}`}>ClickUp sync: {organization.clickup_sync_status}</span></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6"><Stat label="Members" value={`${organization.active_member_count}/${organization.member_count}`} /><Stat label="Admins" value={organization.admin_count} /><Stat label="Spaces" value={`${organization.active_space_count}/${organization.space_count}`} /><Stat label="Videos" value={organization.video_count} /><Stat label="Active links" value={organization.active_watch_links} /><Stat label="Sessions" value={organization.sessions} /><Stat label="Measured" value={organization.measured_sessions} /><Stat label="Watch time" value={formatSeconds(organization.watch_time_seconds)} /></div><p className="mt-3 text-[10px] text-white/30">Created {formatDate(organization.created_at)} · Last activity {formatDate(organization.last_activity_at)} · Last ClickUp sync {formatDate(organization.clickup_last_synced_at)}</p>{organization.clickup_sync_error && <p className="mt-2 text-[11px] text-amber-100/75">Sync evidence: {organization.clickup_sync_error}</p>}{organization.clickup_workspace_id && <SyncAction organizationId={organization.id} />}</div>)}</div></Panel>; }
function SpacesPanel({ data }: { data: ControlRoomData }) { return <Panel title="Space explorer" eyebrow="Organization → Space → resources"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-white/30"><tr><th className="px-3 py-2">Space</th><th className="px-3 py-2">Organization</th><th className="px-3 py-2">ClickUp mapping</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Members</th><th className="px-3 py-2">Videos</th><th className="px-3 py-2">Links</th><th className="px-3 py-2">Sessions</th><th className="px-3 py-2">Viewers</th><th className="px-3 py-2">Completion</th></tr></thead><tbody className="divide-y divide-white/7">{data.spaces.map((space) => <tr key={space.id}><td className="px-3 py-3 font-medium text-white/80">{getSafeSpaceDisplayName(space.name, space.organization_name)}{hasOrganizationSpaceLabelCollision(space.name, space.organization_name) && <span className="ml-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[9px] text-amber-100">name collision</span>}<span className="block text-[10px] text-white/30">{space.clickup_workspace_id ? "legacy workspace link" : "explicit child-space mapping"}</span></td><td className="px-3 py-3 text-white/55">{space.organization_name}</td><td className="px-3 py-3 text-white/55">{space.clickup_space_id ?? "Not mapped"}<span className={`block text-[9px] ${space.clickup_sync_status === "success" ? "text-emerald-200/70" : "text-amber-100/70"}`}>{space.clickup_sync_status}</span></td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[9px] ${statusClass(space.status)}`}>{space.status}</span></td><td className="px-3 py-3 text-white/60">{space.active_member_count}/{space.member_count}</td><td className="px-3 py-3 text-white/60">{space.video_count}</td><td className="px-3 py-3 text-white/60">{space.active_watch_links}</td><td className="px-3 py-3 text-white/60">{space.sessions}</td><td className="px-3 py-3 text-white/60">{space.unique_viewers}</td><td className="px-3 py-3 text-white/60">{space.average_completion_percentage === null ? "Unavailable" : `${space.average_completion_percentage}%`}</td></tr>)}</tbody></table>{data.spaces.length === 0 && <Empty text="No Spaces found in the selected scope." />}</div></Panel>; }
function UsersPanel({ data }: { data: ControlRoomData }) { return <Panel title="User intelligence" eyebrow="Persisted profile and viewer activity"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-white/30"><tr><th className="px-3 py-2">Identity</th><th className="px-3 py-2">Role/status</th><th className="px-3 py-2">Organizations</th><th className="px-3 py-2">Spaces</th><th className="px-3 py-2">Sessions</th><th className="px-3 py-2">Videos</th><th className="px-3 py-2">Watch time</th><th className="px-3 py-2">Completion</th><th className="px-3 py-2">Last activity</th></tr></thead><tbody className="divide-y divide-white/7">{data.users.map((user) => <tr key={user.id}><td className="px-3 py-3"><a href={`/owner/users/${user.id}`} className="font-medium text-violet-200 hover:text-white">{user.name || user.email}</a><span className="block text-[10px] text-white/30">{user.email} · {user.clickup_user_id ?? "No ClickUp ID"}</span></td><td className="px-3 py-3 text-white/55">{user.role} · {user.is_active ? "active" : "inactive"}</td><td className="px-3 py-3 text-white/60">{user.organization_count}</td><td className="px-3 py-3 text-white/60">{user.space_count}</td><td className="px-3 py-3 text-white/60">{user.sessions}</td><td className="px-3 py-3 text-white/60">{user.videos_watched}</td><td className="px-3 py-3 text-white/60">{formatSeconds(user.watch_time_seconds)}</td><td className="px-3 py-3 text-white/60">{user.average_completion_percentage === null ? "Unavailable" : `${user.average_completion_percentage}%`}</td><td className="px-3 py-3 text-white/45">{formatDate(user.last_watched_at)}</td></tr>)}</tbody></table>{data.users.length === 0 && <Empty text="No users match the current search or scope." />}</div></Panel>; }
function VideosPanel({ data }: { data: ControlRoomData }) { return <Panel title="Video intelligence" eyebrow="Video → sessions → viewers"><VideoTable videos={data.videos} /></Panel>; }
function VideoTable({ videos }: { videos: ControlRoomData["videos"] }) { return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-white/30"><tr><th className="px-3 py-2">Video</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">Organization / Space</th><th className="px-3 py-2">Views</th><th className="px-3 py-2">Viewers</th><th className="px-3 py-2">Measured</th><th className="px-3 py-2">Watch time</th><th className="px-3 py-2">Completion</th><th className="px-3 py-2">Last activity</th></tr></thead><tbody className="divide-y divide-white/7">{videos.map((video) => <tr key={video.id}><td className="max-w-56 px-3 py-3"><a href={`/videos/${video.id}`} className="truncate font-medium text-violet-200 hover:text-white">{video.title}</a><span className="block text-[10px] text-white/30">{video.id.slice(0, 8)}…</span></td><td className="px-3 py-3 text-white/55">{video.source_type}</td><td className="px-3 py-3 text-white/55">{video.organization_name}<span className="block text-[10px] text-white/30">{getSafeSpaceDisplayName(video.space_name, video.organization_name)}{hasOrganizationSpaceLabelCollision(video.space_name, video.organization_name) ? " · legacy label" : ""}</span></td><td className="px-3 py-3 text-white/60">{video.total_views}</td><td className="px-3 py-3 text-white/60">{video.unique_viewers}</td><td className="px-3 py-3 text-white/60">{video.measured_sessions}/{video.sessions}</td><td className="px-3 py-3 text-white/60">{formatSeconds(video.watch_time_seconds)}</td><td className="px-3 py-3 text-white/60">{video.average_completion_percentage === null ? "Unavailable" : `${video.average_completion_percentage}%`}</td><td className="px-3 py-3 text-white/45">{formatDate(video.last_activity_at)}</td></tr>)}</tbody></table>{videos.length === 0 && <Empty text="No videos match the current scope." />}</div>; }
function ActivityPanel({ data }: { data: ControlRoomData }) { return <Panel title="Activity and audit" eyebrow="Sanitized persisted server records"><ActivityList data={data} limit={100} /></Panel>; }
function ActivityList({ data, limit }: { data: ControlRoomData; limit: number }) { return data.recent_activity.length === 0 ? <Empty text="No persisted activity in the selected window." /> : <div className="space-y-2">{data.recent_activity.slice(0, limit).map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-white/7 bg-black/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] ${statusClass(item.level)}`}>{item.level}</span><span className="text-[10px] uppercase tracking-wider text-violet-200/70">{item.category}</span><span className="text-xs font-medium text-white/75">{item.action}</span></div><p className="mt-1 truncate text-[10px] text-white/35">{item.organization_name ?? "Platform"}{item.space_name ? ` · ${getSafeSpaceDisplayName(item.space_name, item.organization_name)}` : ""}{item.resource_label ? ` · ${item.resource_label}` : ""}{item.session_id ? ` · session ${item.session_id.slice(0, 8)}…` : ""}</p></div><div className="shrink-0 text-[10px] text-white/35 sm:text-right"><p>{formatDate(item.created_at)}</p><p className={item.result === "ok" ? "text-emerald-200/70" : "text-amber-100/80"}>{item.result}</p></div></div>)}</div>; }
function SecurityPanel({ data }: { data: ControlRoomData }) { return <Panel title="Security center" eyebrow="Observed server-side authorization signals"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Unauthorized" value={data.security.unauthorized} /><Stat label="Forbidden" value={data.security.forbidden} /><Stat label="Auth failures" value={data.security.authentication_failures} /><Stat label="Invalid tokens" value={data.security.invalid_tokens} /><Stat label="Suspicious" value={data.security.suspicious} /><Stat label="Cross-tenant" value={data.security.cross_tenant} /></div><p className="mt-5 text-xs leading-6 text-white/40">Counts are derived from sanitized persisted Owner logs in the selected server time window. Tokens, cookies, headers, keys, and raw sensitive payloads are not displayed.</p></Panel>; }
function JobsPanel({ data }: { data: ControlRoomData }) { const job = data.jobs; const observed = job.execution_status === "observed"; return <Panel title="Jobs and cron" eyebrow="Configured versus observed"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Job" value={job.name} /><Stat label="Schedule" value={job.schedule} /><Stat label="Configured" value={job.configured ? "Yes" : "No"} /><Stat label="Execution" value={observed ? "Observed" : "Not observed"} /><Stat label="Last result" value={job.last_result ?? "No evidence"} /></div><div className={`mt-5 rounded-2xl border p-4 text-xs leading-6 ${observed ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>{observed ? "Execution evidence was persisted by the protected Vercel cron path. Manual authorized health checks are not counted as cron executions." : "The native daily health cron is configured, but no trusted scheduler execution record is available. This panel intentionally does not invent last-run, success, failure, duration, or next-run values."}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Last execution" value={formatDate(job.last_execution_at)} /><Stat label="Last success" value={formatDate(job.last_success_at)} /><Stat label="Last failure" value={formatDate(job.last_failure_at)} /><Stat label="Last latency" value={job.last_latency_ms === null ? "No evidence" : `${job.last_latency_ms}ms`} /><Stat label="Health" value={job.current_health_status} /></div>{job.history.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-[10px]"><thead className="uppercase tracking-wider text-white/30"><tr><th className="px-3 py-2">Started</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">HTTP</th><th className="px-3 py-2">Latency</th><th className="px-3 py-2">Health</th><th className="px-3 py-2">Error code</th></tr></thead><tbody className="divide-y divide-white/7">{job.history.slice(0, 20).map((run) => <tr key={`${run.started_at}-${run.status}`}><td className="px-3 py-2 text-white/55">{formatDate(run.started_at)}</td><td className="px-3 py-2"><span className={`rounded-full border px-2 py-1 ${statusClass(run.status)}`}>{run.status}</span></td><td className="px-3 py-2 text-white/55">{run.http_status ?? "Unavailable"}</td><td className="px-3 py-2 text-white/55">{run.latency_ms === null ? "Unavailable" : `${run.latency_ms}ms`}</td><td className="px-3 py-2 text-white/55">{run.health_status ?? "Unknown"}</td><td className="px-3 py-2 text-white/45">{run.error_code ?? "—"}</td></tr>)}</tbody></table></div>}</Panel>; }
function IncidentsPanel({ data }: { data: ControlRoomData }) { return <Panel title="Incidents" eyebrow="Errors and provider failures only"><IncidentList data={data} limit={20} /></Panel>; }
function IncidentList({ data, limit, onOpen }: { data: ControlRoomData; limit: number; onOpen?: () => void }) { return data.incidents.length === 0 ? <Empty text="No evidence-based incidents in the selected window." /> : <div className="space-y-2">{data.incidents.slice(0, limit).map((incident) => <div key={incident.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/7 bg-black/10 px-3 py-3"><div><div className="flex items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] ${statusClass(incident.severity)}`}>{incident.severity}</span><span className="text-xs font-medium text-white/75">{incident.reason}</span></div><p className="mt-1 text-[10px] text-white/35">{incident.evidence} · {formatDate(incident.detected_at)}</p></div></div>)}{onOpen && <button type="button" onClick={onOpen} className="mt-3 text-xs text-violet-200 hover:text-white">Open all incidents</button>}</div>; }
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="min-w-0 rounded-xl border border-white/7 bg-black/10 p-3"><p className="truncate text-[9px] uppercase tracking-[0.12em] text-white/25">{label}</p><p className="mt-1 break-words text-sm font-semibold text-white/80">{value}</p></div>; }


type SystemHealthState = {
  checked_at: string;
  environment: string;
  deployment_sha: string | null;
  region: string | null;
  database: "connected" | "error";
  database_status: "healthy" | "degraded";
  database_latency_ms: number;
  database_error: "database_unavailable" | null;
};

function isSystemHealthState(value: unknown): value is SystemHealthState {
  if (typeof value !== "object" || value === null) return false;
  return "checked_at" in value && typeof value.checked_at === "string" && "environment" in value && typeof value.environment === "string" && "database_status" in value && (value.database_status === "healthy" || value.database_status === "degraded") && "database_latency_ms" in value && typeof value.database_latency_ms === "number";
}

function PlaybackPanel({ data }: { data: ControlRoomData }) {
  const measured = data.videos.reduce((sum, video) => sum + video.measured_sessions, 0);
  const unavailable = data.videos.reduce((sum, video) => sum + video.unavailable_sessions, 0);
  return <div className="space-y-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Measured sessions" value={measured} /><Stat label="Unavailable sessions" value={unavailable} /><Stat label="Rate fields" value="Typed only" /><Stat label="Seek evidence" value="Session-scoped" /></div><Panel title="Playback evidence coverage" eyebrow="Canonical analytics, not guessed telemetry"><p className="text-xs leading-6 text-white/45">Playback intelligence is derived from stored ordered events and the canonical watched-range service. Provider fields remain null when the provider did not expose reliable evidence. YouTube rate and buffering values are not inferred from page state.</p><div className="mt-5"><VideoTable videos={data.videos} /></div></Panel><Panel title="Forensic drill-down" eyebrow="Video → viewer → session"><p className="text-xs leading-6 text-white/45">Open a video or persisted session from the existing analytics routes to inspect grouped events, raw events on demand, coverage, rate transitions, and seek evidence. This overview does not manufacture a platform-wide seek or speed total when the bounded dataset does not contain that evidence.</p></Panel></div>;
}

function SystemHealthPanel({ databaseOnly = false }: { databaseOnly?: boolean }) {
  const [state, setState] = useState<SystemHealthState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/owner/observability/system", { cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || typeof payload !== "object" || payload === null || !("system" in payload) || !isSystemHealthState(payload.system)) throw new Error("system_health_unavailable");
        setState(payload.system);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "system_health_unavailable");
      }
    };
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (error) return <UnavailablePanel title="System health unavailable" body={`${error}. No healthy status is claimed without a real server probe.`} />;
  if (!state) return <div className="flex min-h-44 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.03] text-xs text-white/40"><RefreshCw size={16} className="mr-2 animate-spin" />Loading server health evidence…</div>;
  const databaseLabel = state.database_status === "healthy" ? "Healthy" : "Degraded";
  return <div className="space-y-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"><Stat label="Database" value={databaseLabel} /><Stat label="Probe latency" value={`${state.database_latency_ms}ms`} /><Stat label="Environment" value={state.environment} /><Stat label="Deployment SHA" value={state.deployment_sha ?? "Unavailable"} /><Stat label="Region" value={state.region ?? "Unavailable"} /><Stat label="Probe checked" value={relative(state.checked_at)} /></div>{!databaseOnly && <div className="grid gap-5 lg:grid-cols-3"><Panel title="API availability" eyebrow="Evidence boundary"><p className="text-sm font-semibold text-white/75">No aggregate uptime claim</p><p className="mt-2 text-xs leading-6 text-white/40">Request-level API failures are visible in Activity / Audit and Security when persisted. A separate uptime monitor is not configured, so availability is not guessed.</p></Panel><Panel title="Provider health" eyebrow="Evidence boundary"><p className="text-sm font-semibold text-white/75">See API / Provider</p><p className="mt-2 text-xs leading-6 text-white/40">Provider status is based on persisted warnings/errors and telemetry coverage, not on an assumed external availability check.</p></Panel><Panel title="Authentication" eyebrow="Evidence boundary"><p className="text-sm font-semibold text-white/75">See Security and Activity</p><p className="mt-2 text-xs leading-6 text-white/40">ClickUp authentication and sync activity are shown only when server logs contain evidence.</p></Panel></div>}<Panel title={`Database ${databaseLabel.toLowerCase()}`} eyebrow="Shared read-only probe"><p className="text-xs leading-6 text-white/45">This uses the same minimal read-only database probe as the protected health endpoint. It does not write tracking, sessions, analytics, or cron records.</p>{state.database_error && <p className="mt-3 text-xs text-amber-100">Database unavailable</p>}<p className="mt-3 text-[10px] text-white/30">Last checked {formatDate(state.checked_at)} · {state.database_latency_ms}ms</p></Panel></div>;
}

function ProviderHealthPanel({ data }: { data: ControlRoomData }) {
  const providerStats = new Map<string, { videos: number; sessions: number; measured: number; unavailable: number }>();
  for (const video of data.videos) {
    const current = providerStats.get(video.source_type) ?? { videos: 0, sessions: 0, measured: 0, unavailable: 0 };
    current.videos += 1;
    current.sessions += video.sessions;
    current.measured += video.measured_sessions;
    current.unavailable += video.unavailable_sessions;
    providerStats.set(video.source_type, current);
  }
  return <div className="space-y-5"><Panel title="API and provider evidence" eyebrow="Observed, not assumed"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Provider warnings/errors" value={data.metrics.provider_errors} /><Stat label="Persisted API activity" value={data.recent_activity.filter((item) => item.category === "API").length} /><Stat label="Provider incidents" value={data.incidents.filter((incident) => incident.reason.startsWith("PROVIDER")).length} /></div><p className="mt-5 text-xs leading-6 text-white/40">A zero error count means no matching persisted errors were observed in the selected window; it does not prove external provider uptime. Telemetry success is shown per provider only where persisted sessions contain measurable evidence.</p></Panel><Panel title="Provider coverage" eyebrow="Video/session evidence"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-white/30"><tr><th className="px-3 py-2">Provider</th><th className="px-3 py-2">Videos</th><th className="px-3 py-2">Sessions</th><th className="px-3 py-2">Measured</th><th className="px-3 py-2">Coverage</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-white/7">{Array.from(providerStats.entries()).map(([provider, stats]) => <tr key={provider}><td className="px-3 py-3 font-medium text-white/75">{provider}</td><td className="px-3 py-3 text-white/55">{stats.videos}</td><td className="px-3 py-3 text-white/55">{stats.sessions}</td><td className="px-3 py-3 text-white/55">{stats.measured}</td><td className="px-3 py-3 text-white/55">{stats.sessions > 0 ? `${Math.round((stats.measured / stats.sessions) * 100)}%` : "Unavailable"}</td><td className="px-3 py-3 text-white/45">{stats.sessions === 0 ? "No evidence" : stats.measured > 0 ? "Measured where available" : "Not measured"}</td></tr>)}</tbody></table>{providerStats.size === 0 && <Empty text="No provider-backed videos in the selected scope." />}</div></Panel></div>;
}

function UnavailablePanel({ title, body }: { title: string; body: string }) { return <Panel title={title} eyebrow="Honest capability boundary"><div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100"><AlertTriangle size={16} className="mt-1 shrink-0" />{body}</div></Panel>; }
