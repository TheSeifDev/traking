"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  FileVideo,
  Link2,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UsersRound,
  Video as VideoIcon,
  X,
} from "lucide-react";
import CreateVideoDialog from "@/src/components/dashboard/CreateVideoDialog";
import type { UserRole } from "@/src/types/auth";
import type { Video as VideoType, VideoSourceType } from "@/src/types/video";

const SOURCE_LABELS: Record<VideoSourceType, string> = {
  youtube: "YouTube",
  google_drive: "Google Drive",
  vimeo: "Vimeo",
  telegram: "Telegram",
  direct_url: "Direct URL",
};

const SOURCE_STYLES: Record<VideoSourceType, string> = {
  youtube: "bg-red-400/10 text-red-200 border-red-300/15",
  google_drive: "bg-blue-400/10 text-blue-200 border-blue-300/15",
  vimeo: "bg-sky-400/10 text-sky-200 border-sky-300/15",
  telegram: "bg-cyan-400/10 text-cyan-200 border-cyan-300/15",
  direct_url: "bg-emerald-400/10 text-emerald-200 border-emerald-300/15",
};

type ProviderFilter = "all" | "youtube" | "google_drive" | "telegram" | "other";
type StatusFilter = "all" | "has_link" | "no_link" | "revoked";
type SortOption = "recent" | "views" | "sessions" | "alphabetical";
type LinkState = "active" | "revoked" | "none";

interface LibrarySummary {
  total_videos: number;
  active_links: number;
  total_sessions: number | null;
  total_viewers: number | null;
}

interface VideosResponse {
  videos?: VideoType[];
  summary?: LibrarySummary;
}

interface VideoListProps {
  role: UserRole;
  spaceId?: string | null;
  spaceCanManage?: boolean;
}

function getYouTubeId(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    const candidate = url.hostname.includes("youtu.be")
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
    return candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function isActiveLink(link: NonNullable<VideoType["watch_links"]>[number], now: number): boolean {
  return !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now);
}

function getLinkState(video: VideoType, now: number): LinkState {
  if ((video.watch_links ?? []).some((link) => isActiveLink(link, now))) return "active";
  if ((video.watch_links ?? []).length > 0) return "revoked";
  return "none";
}

function providerMatches(video: VideoType, filter: ProviderFilter): boolean {
  if (filter === "all") return true;
  if (filter === "other") return video.source_type === "vimeo" || video.source_type === "telegram" || video.source_type === "direct_url";
  return video.source_type === filter;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "Unavailable";
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  if (safe < 3600) return `${Math.floor(safe / 60)}m ${safe % 60}s`;
  return `${Math.floor(safe / 3600)}h ${Math.floor((safe % 3600) / 60)}m`;
}

function linkStateCopy(state: LinkState): { label: string; detail: string; className: string } {
  if (state === "active") return { label: "Active", detail: "Viewer access is live", className: "bg-emerald-400/10 text-emerald-200" };
  if (state === "revoked") return { label: "Revoked", detail: "No active viewer link", className: "bg-red-400/10 text-red-200" };
  return { label: "Not created", detail: "Create a TrackUp viewer link", className: "bg-white/[0.06] text-white/55" };
}

function formatError(error: string): string {
  if (error === "no_workspace") return "Connect a ClickUp workspace to view your videos.";
  if (error === "forbidden") return "Your role does not have permission to manage this library.";
  return error || "Unable to load your video library.";
}

export default function VideoList({ role, spaceId = null, spaceCanManage }: VideoListProps) {
  const canManage = spaceCanManage ?? (role === "owner" || role === "admin");
  const encodedSpaceId = spaceId ? encodeURIComponent(spaceId) : "";
  const scopeQuery = encodedSpaceId ? `?space_id=${encodedSpaceId}` : "";
  const scopedPath = (path: string) => `${path}${encodedSpaceId ? `${path.includes("?") ? "&" : "?"}space_id=${encodedSpaceId}` : ""}`;
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos${scopeQuery}`, { cache: "no-store" });
      const data: VideosResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatError(String((data as { error?: unknown }).error ?? "Unable to load your video library.")));
        return;
      }
      setVideos(Array.isArray(data.videos) ? data.videos : []);
      setSummary(data.summary ?? null);
    } catch {
      setError("Network error while loading the video library.");
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchVideos(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchVideos]);

  const derivedSummary = useMemo<LibrarySummary>(() => ({
    total_videos: videos.length,
    active_links: videos.reduce((total, video) => total + ((video.watch_links ?? []).some((link) => isActiveLink(link, currentTime)) ? 1 : 0), 0),
    total_sessions: videos.reduce((total, video) => total + (video.view_count ?? 0), 0),
    total_viewers: null,
  }), [currentTime, videos]);
  const librarySummary = summary ?? derivedSummary;

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return videos
      .filter((video) => providerMatches(video, providerFilter))
      .filter((video) => {
        const state = getLinkState(video, currentTime);
        if (statusFilter === "has_link") return state === "active";
        if (statusFilter === "no_link") return state === "none";
        if (statusFilter === "revoked") return state === "revoked";
        return true;
      })
      .filter((video) => !query || [video.title, video.description ?? "", SOURCE_LABELS[video.source_type], video.source_url].join(" ").toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortBy === "alphabetical") return a.title.localeCompare(b.title);
        if (sortBy === "views" || sortBy === "sessions") return (b.view_count ?? 0) - (a.view_count ?? 0) || a.title.localeCompare(b.title);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [currentTime, providerFilter, search, sortBy, statusFilter, videos]);

  async function copyUrl(url: string): Promise<boolean> {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(url);
    return true;
  }

  async function handleShare(video: VideoType) {
    if (!canManage) return;
    setSharing(video.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(scopedPath(`/api/videos/${video.id}/watch-link`), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to generate a viewer link.");
        return;
      }
      const url = data.watch_link?.url;
      if (typeof url !== "string" || !url) {
        setError("The server did not return a viewer link.");
        return;
      }
      if (!await copyUrl(url)) {
        setError("The viewer link is ready, but clipboard access was unavailable. Open Details to copy it manually.");
        await fetchVideos();
        return;
      }
      setNotice(data.watch_link.reused ? "The active TrackUp viewer link was copied." : "Viewer link created and copied to your clipboard.");
      await fetchVideos();
    } catch {
      setError("The viewer link request failed. Please retry.");
    } finally {
      setSharing(null);
    }
  }

  async function handleRevoke(video: VideoType) {
    if (!canManage) return;
    const activeLink = (video.watch_links ?? []).find((link) => isActiveLink(link, currentTime));
    if (!activeLink || !window.confirm(`Revoke viewer access for “${video.title}”?`)) return;
    setRevoking(video.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(scopedPath(`/api/videos/${video.id}/watch-link`), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link_id: activeLink.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to revoke this viewer link.");
        return;
      }
      setNotice("Viewer access revoked. Historical analytics remain available.");
      await fetchVideos();
    } catch {
      setError("The viewer link could not be revoked. Please retry.");
    } finally {
      setRevoking(null);
    }
  }

  async function handleOpenViewer(video: VideoType) {
    const activeLink = (video.watch_links ?? []).find((link) => isActiveLink(link, currentTime));
    if (!activeLink) {
      setError("Create an active viewer link before opening the viewer.");
      return;
    }
    window.open(`${window.location.origin}/watch/${activeLink.token}`, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(video: VideoType) {
    if (!canManage || !window.confirm(`Delete “${video.title}” and its watch data?`)) return;
    setDeleting(video.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(scopedPath(`/api/videos/${video.id}`), { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to delete this video.");
        return;
      }
      setVideos((current) => current.filter((item) => item.id !== video.id));
      setSummary((current) => current ? { ...current, total_videos: Math.max(0, current.total_videos - 1) } : current);
      setNotice("Video deleted.");
    } catch {
      setError("Network error while deleting this video.");
    } finally {
      setDeleting(null);
    }
  }

  const manageMessage = canManage
    ? "Create, manage, and share your videos through TrackUp."
    : "Viewer access is read-only. You can open videos and review measured analytics.";
  const hasFilters = Boolean(search || providerFilter !== "all" || statusFilter !== "all" || sortBy !== "recent");

  return (
    <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1440px] space-y-7">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Library</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Videos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">{manageMessage}</p></div>{canManage && <CreateVideoDialog onCreated={fetchVideos} spaceId={spaceId} />}</header>

        {(error || notice) && <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-300/20 bg-red-400/[0.08] text-red-100" : "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100"}`}>{error ? <AlertCircle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle size={17} className="mt-0.5 shrink-0" />}<span className="min-w-0 flex-1">{error ?? notice}</span><button onClick={() => { setError(null); setNotice(null); }} className="shrink-0 text-white/45 transition hover:text-white" aria-label="Dismiss notification"><X size={16} /></button></div>}

        <section aria-label="Library summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/9 bg-white/9 sm:grid-cols-4"><SummaryMetric label="Total videos" value={loading ? "—" : librarySummary.total_videos.toLocaleString()} detail="Workspace library" icon={FileVideo} /><SummaryMetric label="Active links" value={loading ? "—" : librarySummary.active_links.toLocaleString()} detail="One per video maximum" icon={Link2} /><SummaryMetric label="Total sessions" value={loading ? "—" : librarySummary.total_sessions === null ? "Unavailable" : librarySummary.total_sessions.toLocaleString()} detail={librarySummary.total_sessions === null ? "Analytics unavailable" : "Recorded viewer visits"} icon={Eye} /><SummaryMetric label="Total viewers" value={loading ? "—" : librarySummary.total_viewers === null ? "Unavailable" : librarySummary.total_viewers.toLocaleString()} detail={librarySummary.total_viewers === null ? "Analytics unavailable" : "One-way identities"} icon={UsersRound} /></section>

        <section aria-label="Video library filters" className="rounded-2xl border border-white/9 bg-white/[0.03] p-4 sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><label className="relative block min-w-0 flex-1 xl:max-w-xl"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" /><span className="sr-only">Search videos</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos, descriptions, providers..." className="w-full rounded-xl border border-white/10 bg-black/15 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-violet-300/45 placeholder:text-white/28" /></label><div className="flex items-center gap-2 text-xs text-white/35"><SlidersHorizontal size={15} /><span>{loading ? "Loading library" : `${filteredVideos.length} of ${videos.length} videos`}</span></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><FilterSelect label="Provider" value={providerFilter} onChange={(value) => setProviderFilter(value as ProviderFilter)} options={[["all", "All providers"], ["youtube", "YouTube"], ["google_drive", "Google Drive"], ["telegram", "Telegram"], ["other", "Other supported"]]} /><FilterSelect label="Viewer link" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[["all", "All statuses"], ["has_link", "Has viewer link"], ["no_link", "No viewer link"], ["revoked", "Revoked"]]} /><FilterSelect label="Sort by" value={sortBy} onChange={(value) => setSortBy(value as SortOption)} options={[["recent", "Recently added"], ["views", "Most viewed"], ["sessions", "Most sessions"], ["alphabetical", "Alphabetical"]]} /></div>{hasFilters && <button onClick={() => { setSearch(""); setProviderFilter("all"); setStatusFilter("all"); setSortBy("recent"); }} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-300 transition hover:text-violet-200">Clear filters <X size={13} /></button>}</section>

        {loading ? <LoadingGrid /> : error && videos.length === 0 ? <ErrorState onRetry={() => void fetchVideos()} /> : filteredVideos.length === 0 ? <EmptyState hasFilters={hasFilters} canManage={canManage} onClear={() => { setSearch(""); setProviderFilter("all"); setStatusFilter("all"); setSortBy("recent"); }} /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filteredVideos.map((video) => <VideoCard key={video.id} video={video} canManage={canManage} currentTime={currentTime} sharing={sharing === video.id} revoking={revoking === video.id} deleting={deleting === video.id} onShare={() => void handleShare(video)} onOpenViewer={() => void handleOpenViewer(video)} onRevoke={() => void handleRevoke(video)} onDelete={() => void handleDelete(video)} />)}</div>}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof FileVideo }) {
  return <article className="min-w-0 bg-[#10102d] p-4 sm:p-5"><div className="flex items-center gap-2 text-xs font-medium text-white/45"><Icon size={15} className="text-violet-300/80" />{label}</div><p className="mt-4 truncate text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 truncate text-[11px] text-white/30">{detail}</p></article>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="block text-xs text-white/38">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-white/9 bg-black/15 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-300/45">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function LoadingGrid() {
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading videos">{Array.from({ length: 6 }, (_, index) => <div key={index} className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03]"><div className="aspect-video animate-pulse bg-white/[0.06]" /><div className="space-y-4 p-5"><div className="h-5 w-3/4 animate-pulse rounded bg-white/8" /><div className="h-3 w-1/2 animate-pulse rounded bg-white/6" /><div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" /><div className="h-10 animate-pulse rounded-xl bg-white/[0.05]" /></div></div>)}</div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-red-300/15 bg-red-400/[0.05] px-6 py-12 text-center"><AlertCircle size={32} className="text-red-300/75" /><h2 className="mt-4 text-base font-semibold text-white">We could not load the library</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/42">The request did not complete. Your videos were not changed. Retry to request the real library again.</p><button onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"><RefreshCw size={15} />Retry</button></div>;
}

function EmptyState({ hasFilters, canManage, onClear }: { hasFilters: boolean; canManage: boolean; onClear: () => void }) {
  return <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/[0.018] px-6 py-12 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><FileVideo size={25} /></div><p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/60">Video library</p><h2 className="mt-2 text-xl font-semibold text-white">{hasFilters ? "No videos match these filters" : "Your videos will appear here"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">{hasFilters ? "Try a different provider, viewer-link status, search term, or sort view." : canManage ? "Add your first video to create an internal TrackUp viewing experience and shareable viewer link." : "No videos have been shared with this workspace yet."}</p>{hasFilters ? <button onClick={onClear} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200"><X size={15} />Clear filters</button> : canManage ? <Link href="/videos" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/25 transition hover:bg-violet-400"><Plus size={16} />Add your first video</Link> : null}</div>;
}

function VideoCard({ video, canManage, currentTime, sharing, revoking, deleting, onShare, onOpenViewer, onRevoke, onDelete }: { video: VideoType; canManage: boolean; currentTime: number; sharing: boolean; revoking: boolean; deleting: boolean; onShare: () => void; onOpenViewer: () => void; onRevoke: () => void; onDelete: () => void }) {
  const youtubeId = video.source_type === "youtube" ? getYouTubeId(video.source_url) : null;
  const linkState = getLinkState(video, currentTime);
  const linkCopy = linkStateCopy(linkState);
  const activeLink = (video.watch_links ?? []).find((link) => isActiveLink(link, currentTime));
  const providerLabel = SOURCE_LABELS[video.source_type];
  const providerStyle = SOURCE_STYLES[video.source_type];

  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/9 bg-white/[0.035] shadow-[0_18px_65px_rgba(0,0,0,0.14)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-white/[0.05]"><Link href={`/videos/${video.id}`} className="relative block aspect-video overflow-hidden bg-[#171735]" aria-label={`Open ${video.title} details`}>{youtubeId ? <div role="img" aria-label={`Thumbnail for ${video.title}`} className="h-full w-full bg-cover bg-center transition duration-300 group-hover:scale-[1.03]" style={{ backgroundImage: `url(https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg)` }}><div className="h-full w-full bg-gradient-to-t from-black/75 via-black/10 to-transparent" /></div> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-500/10 to-cyan-500/5 text-white/20"><VideoIcon size={42} /></div>}<div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2"><span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${providerStyle}`}>{providerLabel}</span><span className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${linkCopy.className}`}>{linkCopy.label}</span></div><div className="absolute bottom-4 left-4 flex items-center gap-2 text-[10px] font-medium text-white/75"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45"><PlayCircle size={13} /></span>{video.duration ? formatDuration(video.duration) : "TrackUp viewer"}</div></Link><div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/videos/${video.id}`} className="block truncate text-base font-semibold text-white transition hover:text-violet-200">{video.title}</Link><p className="mt-1 truncate text-xs text-white/35">Added {new Date(video.created_at).toLocaleDateString()} · {providerLabel}</p></div><Link href={`/videos/${video.id}`} aria-label={`Open ${video.title} details`} className="shrink-0 rounded-lg p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"><ArrowUpRight size={16} /></Link></div><p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-white/42">{video.description || "No description added."}</p><div className="mt-5 grid grid-cols-3 divide-x divide-white/8 border-y border-white/8 py-4 text-center"><div><p className="text-lg font-semibold text-white">{video.view_count ?? 0}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/32">Sessions</p></div><div><p className="text-lg font-semibold text-white">{video.unique_viewer_count === null ? "—" : video.unique_viewer_count ?? 0}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/32">Viewers</p></div><div><p className="text-lg font-semibold text-white">{video.playback_metrics_available && video.avg_completion !== null && video.avg_completion !== undefined ? `${video.avg_completion}%` : "—"}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/32">Completion</p></div></div><div className="mt-4 flex items-start gap-3 rounded-2xl bg-black/12 p-3"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${linkCopy.className}`}><Link2 size={15} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white/80">Viewer link · {linkCopy.label}</p><p className="mt-1 truncate text-[11px] text-white/35">{linkCopy.detail}</p></div></div>{video.playback_metrics_available ? <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-200/65"><CheckCircle size={13} />{formatDuration(video.measurable_watch_time_seconds)} measured watch time</p> : <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/35"><Clock3 size={13} />Playback metrics unavailable for this provider/session data</p>}<div className="mt-5 flex flex-wrap gap-2"><Link href={`/videos/${video.id}`} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400"><Eye size={14} />Open details <ChevronRight size={13} /></Link>{activeLink && <button onClick={onOpenViewer} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-white/65 transition hover:border-white/20 hover:text-white"><ExternalLink size={14} />Open viewer</button>}</div><div className="mt-2 flex flex-wrap items-center gap-3 text-xs">{canManage && <button onClick={onShare} disabled={sharing} className="inline-flex items-center gap-1.5 text-violet-300 transition hover:text-violet-200 disabled:opacity-45">{sharing ? <Loader2 size={13} className="animate-spin" /> : activeLink ? <Copy size={13} /> : <Link2 size={13} />}{activeLink ? "Copy link" : "Create viewer link"}</button>}{canManage && activeLink && <button onClick={onRevoke} disabled={revoking} className="inline-flex items-center gap-1.5 text-white/38 transition hover:text-red-200 disabled:opacity-45">{revoking ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}Revoke</button>}{canManage && <button onClick={onDelete} disabled={deleting} className="ml-auto inline-flex items-center gap-1.5 text-white/25 transition hover:text-red-200 disabled:opacity-45">{deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}Delete</button>}</div></div></article>;
}
