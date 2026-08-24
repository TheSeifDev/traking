"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Eye,
  FileVideo,
  Filter,
  Link2,
  Search,
  ShieldCheck,
  UsersRound,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import WatchLinkPanel from "@/src/components/dashboard/WatchLinkPanel";
import type { UserRole } from "@/src/types/auth";
import type { Video, VideoSourceType, WatchLink } from "@/src/types/video";

const SOURCE_LABELS: Record<VideoSourceType, string> = {
  youtube: "YouTube",
  google_drive: "Google Drive",
  vimeo: "Vimeo",
  telegram: "Telegram",
  direct_url: "Direct URL",
};

const SOURCE_STYLES: Record<VideoSourceType, string> = {
  youtube: "border-red-300/15 bg-red-400/10 text-red-100",
  google_drive: "border-blue-300/15 bg-blue-400/10 text-blue-100",
  vimeo: "border-sky-300/15 bg-sky-400/10 text-sky-100",
  telegram: "border-cyan-300/15 bg-cyan-400/10 text-cyan-100",
  direct_url: "border-emerald-300/15 bg-emerald-400/10 text-emerald-100",
};

type StatusFilter = "all" | "active" | "none" | "history";
type SortOption = "recent" | "views" | "alphabetical";

interface WatchLinksManagerProps {
  videos: Video[];
  role: UserRole;
  appOrigin: string;
  hasWorkspace: boolean;
  spaceId?: string | null;
  organizationId?: string | null;
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

function isActiveLink(link: WatchLink, now: number): boolean {
  return !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString();
}

function countForVideo(video: Video): number {
  return video.view_count ?? 0;
}

function formatWatchTime(video: Video): string {
  if (!video.playback_metrics_available || video.measurable_watch_time_seconds === null || video.measurable_watch_time_seconds === undefined) return "Not measured";
  const seconds = Math.max(0, Math.round(video.measurable_watch_time_seconds));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function activeLinkFor(video: Video, now: number): WatchLink | undefined {
  return (video.watch_links ?? []).find((link) => isActiveLink(link, now));
}

export default function WatchLinksManager({ videos: initialVideos, role, appOrigin, hasWorkspace, spaceId = null, organizationId = null, spaceCanManage }: WatchLinksManagerProps) {
  const canManage = spaceCanManage ?? (role === "owner" || role === "admin");
  const scopedQuery = spaceId
    ? `?space_id=${encodeURIComponent(spaceId)}`
    : organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
  const [videos, setVideos] = useState(initialVideos);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [now] = useState(() => Date.now());

  const summary = useMemo(() => {
    const totalViews = videos.reduce((total, video) => total + countForVideo(video), 0);
    const activeLinks = videos.reduce((total, video) => total + (activeLinkFor(video, now) ? 1 : 0), 0);
    const revokedLinks = videos.reduce(
      (total, video) => total + (video.watch_links ?? []).filter((link) => Boolean(link.revoked_at)).length,
      0,
    );
    return { activeLinks, revokedLinks, totalViews };
  }, [now, videos]);

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return videos
      .filter((video) => {
        if (statusFilter === "active") return Boolean(activeLinkFor(video, now));
        if (statusFilter === "none") return !activeLinkFor(video, now) && !(video.watch_links ?? []).some((link) => Boolean(link.revoked_at));
        if (statusFilter === "history") return (video.watch_links ?? []).some((link) => Boolean(link.revoked_at));
        return true;
      })
      .filter((video) => {
        if (!query) return true;
        return [video.title, video.description ?? "", SOURCE_LABELS[video.source_type], video.source_url]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sortBy === "alphabetical") return a.title.localeCompare(b.title);
        if (sortBy === "views") return countForVideo(b) - countForVideo(a) || a.title.localeCompare(b.title);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [now, search, sortBy, statusFilter, videos]);

  function updateLinks(videoId: string, links: WatchLink[]) {
    setVideos((current) => current.map((video) => (video.id === videoId ? { ...video, watch_links: links } : video)));
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSortBy("recent");
  }

  const hasFilters = Boolean(search.trim() || statusFilter !== "all" || sortBy !== "recent");

  return (
    <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1480px] space-y-7">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Access management</p>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
              <Link2 className="text-violet-300" size={27} />
              Watch links
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Manage one private TrackUp viewer link per video. Session counts are recorded views; playback metrics remain Not measured unless valid provider telemetry is stored.</p>
          </div>
          <Link href={scopedQuery ? `/videos${scopedQuery}` : "/videos"} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white sm:w-auto">
            Open video library
            <ArrowUpRight size={15} />
          </Link>
        </header>

        <section aria-label="Watch link summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/9 bg-white/9 md:grid-cols-4">
          <SummaryMetric label="Active links" value={summary.activeLinks} detail="One per video maximum" icon={Activity} tone="emerald" />
          <SummaryMetric label="Videos" value={videos.length} detail="Workspace-scoped library" icon={FileVideo} />
          <SummaryMetric label="Total views" value={summary.totalViews} detail="Recorded watch sessions" icon={Eye} />
          <SummaryMetric label="Revoked links" value={summary.revokedLinks} detail="Retained for audit" icon={ShieldCheck} tone="amber" />
        </section>

        {!hasWorkspace ? (
          <EmptyState title="Connect a ClickUp workspace" description="Connect a workspace before managing viewer access." icon={Link2} />
        ) : videos.length === 0 ? (
          <EmptyState title="Your watch links will appear here" description="Add a video first, then create a secure TrackUp viewer link for it." icon={VideoIcon} actionHref={scopedQuery ? `/videos${scopedQuery}` : "/videos"} actionLabel="Open video library" />
        ) : (
          <>
            <section aria-label="Watch link filters" className="rounded-2xl border border-white/9 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <label className="relative block min-w-0 flex-1 xl:max-w-2xl">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <span className="sr-only">Search watch links</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos, providers, or source URLs..." type="search" className="w-full rounded-xl border border-white/10 bg-black/15 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-violet-300/45" />
                </label>
                <div className="flex items-center gap-2 text-xs text-white/35"><Filter size={15} />{filteredVideos.length} of {videos.length} videos</div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FilterSelect label="Access status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[["all", "All videos"], ["active", "Active link"], ["none", "No active link"], ["history", "Has revoked history"]]} />
                <FilterSelect label="Sort by" value={sortBy} onChange={(value) => setSortBy(value as SortOption)} options={[["recent", "Recently added"], ["views", "Most views"], ["alphabetical", "Alphabetical"]]} />
              </div>
              {hasFilters && <button onClick={clearFilters} className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-xs font-medium text-violet-300 transition hover:text-violet-200"><X size={13} />Clear filters</button>}
            </section>

            {filteredVideos.length === 0 ? (
              <EmptyState title="No videos match these filters" description="Try a different search term or access status." actionLabel="Clear filters" onAction={clearFilters} icon={Search} />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredVideos.map((video) => <VideoAccessCard key={video.id} video={video} now={now} canManage={canManage} appOrigin={appOrigin} spaceId={spaceId} organizationId={organizationId} onLinksChange={(links) => updateLinks(video.id, links)} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VideoAccessCard({ video, now, canManage, appOrigin, spaceId, organizationId, onLinksChange }: { video: Video; now: number; canManage: boolean; appOrigin: string; spaceId?: string | null; organizationId?: string | null; onLinksChange: (links: WatchLink[]) => void }) {
  const effectiveSpaceId = spaceId ?? (organizationId ? null : video.space_id ?? null);
  const scopedQuery = effectiveSpaceId
    ? `?space_id=${encodeURIComponent(effectiveSpaceId)}`
    : organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
  const youtubeId = video.source_type === "youtube" ? getYouTubeId(video.source_url) : null;
  const links = video.watch_links ?? [];
  const activeLink = activeLinkFor(video, now);
  const historyCount = links.filter((link) => Boolean(link.revoked_at)).length;
  const providerLabel = SOURCE_LABELS[video.source_type];
  const statusLabel = activeLink ? "Active" : historyCount > 0 ? "Revoked" : "No link";
  const statusClass = activeLink ? "border-emerald-300/20 bg-emerald-400/15 text-emerald-100" : historyCount > 0 ? "border-red-300/20 bg-red-400/15 text-red-100" : "border-white/10 bg-black/35 text-white/70";
  const viewerCount = video.unique_viewer_count === null || video.unique_viewer_count === undefined ? "—" : video.unique_viewer_count;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/9 bg-white/[0.035] shadow-[0_18px_65px_rgba(0,0,0,0.14)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/20 hover:bg-white/[0.045]">
      <Link href={scopedQuery ? `/videos/${video.id}${scopedQuery}` : `/videos/${video.id}`} className="relative block aspect-video min-w-0 shrink-0 overflow-hidden bg-[#171735]" aria-label={`Open ${video.title} details`}>
        {youtubeId ? <div role="img" aria-label={`Thumbnail for ${video.title}`} className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.03]" style={{ backgroundImage: `url(https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg)` }}><div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" /></div> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/10 to-cyan-500/5 text-white/20"><VideoIcon size={42} /></div>}
        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          <span className={`max-w-[48%] truncate rounded-lg border px-2 py-1 text-[10px] font-semibold ${SOURCE_STYLES[video.source_type]}`}>{providerLabel}</span>
          <span className={`max-w-[48%] truncate rounded-lg border px-2 py-1 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={scopedQuery ? `/videos/${video.id}${scopedQuery}` : `/videos/${video.id}`} className="block line-clamp-2 min-h-12 break-words text-lg font-semibold leading-6 tracking-tight text-white transition hover:text-violet-200">{video.title}</Link>
            <p className="mt-2 flex min-w-0 items-center gap-1.5 truncate text-xs text-white/35"><CalendarDays size={13} className="shrink-0" />Added {formatDate(video.created_at)}</p>
          </div>
          <Link href={scopedQuery ? `/videos/${video.id}${scopedQuery}` : `/videos/${video.id}`} aria-label={`Open ${video.title} details`} className="shrink-0 rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"><ArrowUpRight size={17} /></Link>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-white/8 border-y border-white/8 py-3 text-center">
          <Metric label="Sessions" value={links.reduce((total, link) => total + (link.session_count ?? 0), 0)} />
          <Metric label="Viewers" value={viewerCount} icon={UsersRound} />
          <Metric label="Watch time" value={formatWatchTime(video)} unavailable={!video.playback_metrics_available} />
        </div>

        <div className="mt-5 min-w-0">
            <WatchLinkPanel videoId={video.id} existingLinks={links} canManage={canManage} appOrigin={appOrigin} spaceId={effectiveSpaceId} detailsHref={scopedQuery ? `/videos/${video.id}${scopedQuery}` : `/videos/${video.id}`} onLinksChange={onLinksChange} />
        </div>
      </div>
    </article>
  );
}

function SummaryMetric({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: number; detail: string; icon: typeof Activity; tone?: "default" | "emerald" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-200/75" : tone === "amber" ? "text-amber-200/75" : "text-white/45";
  return <article className="min-w-0 bg-[#10102d] p-4 sm:p-5"><div className={`flex items-center gap-2 text-xs font-medium ${toneClass}`}><Icon size={15} />{label}</div><p className="mt-4 truncate text-2xl font-semibold tracking-tight text-white">{value.toLocaleString()}</p><p className="mt-1 truncate text-[11px] text-white/30">{detail}</p></article>;
}

function Metric({ label, value, icon: Icon, unavailable = false }: { label: string; value: number | string; icon?: typeof UsersRound; unavailable?: boolean }) {
  return <div className="min-w-0"><p className={`flex min-h-6 items-center justify-center gap-1 break-words text-sm font-semibold sm:text-base ${unavailable ? "text-white/45" : "text-white"}`}>{Icon && <Icon size={13} className="shrink-0 text-white/35" />}{typeof value === "number" ? value.toLocaleString() : value}</p><p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/30 sm:text-[10px]">{label}</p></div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="block text-xs text-white/38">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-white/9 bg-black/15 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-300/45">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function EmptyState({ title, description, icon: Icon, actionHref, actionLabel, onAction }: { title: string; description: string; icon: typeof Link2; actionHref?: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/[0.018] px-6 py-12 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><Icon size={25} /></div><h2 className="mt-5 text-xl font-semibold text-white">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">{description}</p>{actionHref && actionLabel ? <Link href={actionHref} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400">{actionLabel}<ArrowUpRight size={15} /></Link> : onAction && actionLabel ? <button onClick={onAction} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">{actionLabel}<X size={15} /></button> : null}</div>;
}
