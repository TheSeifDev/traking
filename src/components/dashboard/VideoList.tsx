"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  ExternalLink,
  Link2,
  Search,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";
import CreateVideoDialog from "@/src/components/dashboard/CreateVideoDialog";
import type { UserRole } from "@/src/types/auth";
import type { Video as VideoType } from "@/src/types/video";

const SOURCE_LABELS: Record<string, string> = {
  youtube: "YouTube",
  google_drive: "Google Drive",
  vimeo: "Vimeo",
  telegram: "Telegram",
  direct_url: "Direct URL",
};

const SOURCE_STYLES: Record<string, string> = {
  youtube: "bg-red-500/10 text-red-200 border-red-400/15",
  google_drive: "bg-blue-500/10 text-blue-200 border-blue-400/15",
  vimeo: "bg-sky-500/10 text-sky-200 border-sky-400/15",
  telegram: "bg-cyan-500/10 text-cyan-200 border-cyan-400/15",
  direct_url: "bg-emerald-500/10 text-emerald-200 border-emerald-400/15",
};

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

interface VideoListProps {
  role: UserRole;
}

export default function VideoList({ role }: VideoListProps) {
  const canManage = role === "owner" || role === "admin";
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentTime] = useState(() => new Date().getTime());
  const [sharing, setSharing] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/videos", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "no_workspace" ? "Connect a ClickUp workspace to view videos." : "Unable to load your video library.");
        return;
      }
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch {
      setError("Network error while loading the video library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVideos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchVideos]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return videos;
    return videos.filter((video) =>
      [video.title, video.description ?? "", SOURCE_LABELS[video.source_type] ?? video.source_type]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, videos]);

  async function handleDelete(video: VideoType) {
    if (!canManage || !window.confirm(`Delete “${video.title}” and its watch data?`)) return;
    setDeleting(video.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to delete this video.");
        return;
      }
      setVideos((current) => current.filter((item) => item.id !== video.id));
      setNotice("Video deleted.");
    } catch {
      setError("Network error while deleting this video.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleShare(video: VideoType) {
    if (!canManage) return;
    setSharing(video.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/watch-link`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to generate a watch link.");
        return;
      }
      const url = data.watch_link?.url;
      if (typeof url !== "string" || !url) {
        setError("The server did not return a watch link.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice("Watch link created and copied to your clipboard.");
      await fetchVideos();
    } catch {
      setError("The link was created, but copying it failed. Open the video to copy it manually.");
    } finally {
      setSharing(null);
    }
  }

  const manageMessage = canManage
    ? "Create, share, and manage viewer access from each video."
    : "Viewer access is read-only. You can open videos and review measured analytics.";

  return (
    <div className="p-6 lg:p-8 space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Library</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Videos</h1>
          <p className="mt-1 text-sm text-white/45">{manageMessage}</p>
        </div>
        {canManage && <CreateVideoDialog onCreated={fetchVideos} />}
      </header>

      {(error || notice) && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>
          {error ? <AlertCircle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle size={17} className="mt-0.5 shrink-0" />}
          <span>{error ?? notice}</span>
          {error && <button onClick={() => setError(null)} className="ml-auto text-xs text-white/50 hover:text-white">Dismiss</button>}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-white/55">
          <span className="rounded-lg bg-violet-500/10 p-2 text-violet-300"><VideoIcon size={16} /></span>
          <span><strong className="text-white">{videos.length}</strong> {videos.length === 1 ? "video" : "videos"}</span>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <span className="sr-only">Search videos</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search videos..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-400/50 placeholder:text-white/30"
          />
        </label>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-white/6 bg-white/[0.03]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
          <VideoIcon size={34} className="mx-auto mb-4 text-white/15" />
          <h2 className="text-base font-semibold text-white">{search ? "No matching videos" : "Your library is empty"}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/40">{search ? `Nothing matches “${search}”. Try another search.` : canManage ? "Add a video to create an internal TrackUp viewing experience and shareable watch link." : "No videos have been shared with this workspace yet."}</p>
          {search && <button onClick={() => setSearch("")} className="mt-5 text-sm text-violet-300 hover:text-violet-200">Clear search</button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((video) => {
            const sourceLabel = SOURCE_LABELS[video.source_type] ?? video.source_type;
            const sourceStyle = SOURCE_STYLES[video.source_type] ?? "bg-white/5 text-white/60 border-white/10";
            const youtubeId = video.source_type === "youtube" ? getYouTubeId(video.source_url) : null;
            const activeLinks = video.watch_links?.filter((link) => {
              const expired = Boolean(link.expires_at && new Date(link.expires_at).getTime() <= currentTime);
              return !link.revoked_at && !expired;
            }).length ?? 0;
            const statusLabel = activeLinks > 0 ? "Shared" : (video.watch_links?.length ?? 0) > 0 ? "Revoked" : "Ready";
            const statusStyle = activeLinks > 0 ? "bg-emerald-500/10 text-emerald-200" : statusLabel === "Revoked" ? "bg-red-500/10 text-red-200" : "bg-white/5 text-white/45";
            return (
              <article key={video.id} className="group flex min-h-52 flex-col rounded-2xl border border-white/8 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/25 hover:bg-white/[0.05]">
                <div className="mb-4 h-32 overflow-hidden rounded-xl border border-white/8 bg-black/20">
                  {youtubeId ? <div role="img" aria-label={`Thumbnail for ${video.title}`} className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg)` }}><div className="h-full w-full bg-gradient-to-t from-black/60 to-transparent" /></div> : <div className="flex h-full items-center justify-center text-white/15"><VideoIcon size={30} /></div>}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><VideoIcon size={17} /></div>
                    <div className="min-w-0">
                      <Link href={`/videos/${video.id}`} className="block truncate font-semibold text-white transition hover:text-violet-200">{video.title}</Link>
                      <p className="mt-1 text-xs text-white/35">Added {new Date(video.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5"><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${sourceStyle}`}>{sourceLabel}</span><span className={`rounded-full px-2 py-1 text-[10px] ${statusStyle}`}>{statusLabel}</span></div>
                </div>

                <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-white/45">{video.description || "No description added."}</p>

                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/7 pt-4 text-center">
                  <div><p className="text-lg font-semibold text-white">{video.view_count ?? 0}</p><p className="text-[10px] uppercase tracking-wide text-white/35">Views</p></div>
                  <div><p className="text-lg font-semibold text-white">{video.watch_links?.length ?? 0}</p><p className="text-[10px] uppercase tracking-wide text-white/35">Links</p></div>
                  <div><p className="text-lg font-semibold text-white">{video.avg_completion === null || video.avg_completion === undefined ? "—" : `${video.avg_completion}%`}</p><p className="text-[10px] uppercase tracking-wide text-white/35">Completion</p></div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Link href={`/videos/${video.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600/15 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-600/25"><Eye size={14} />Open details</Link>
                  {canManage && <button onClick={() => void handleShare(video)} disabled={sharing === video.id} title="Create and copy watch link" className="rounded-xl border border-white/10 p-2 text-white/45 transition hover:border-violet-400/30 hover:text-violet-200 disabled:opacity-50"><Link2 size={15} /></button>}
                  {canManage && <button onClick={() => void handleDelete(video)} disabled={deleting === video.id} title="Delete video" className="rounded-xl border border-white/10 p-2 text-white/35 transition hover:border-red-400/25 hover:text-red-200 disabled:opacity-50"><Trash2 size={15} /></button>}
                  <Link href={`/videos/${video.id}`} title="Open details" className="hidden rounded-xl border border-white/10 p-2 text-white/35 transition hover:text-white sm:block"><ExternalLink size={15} /></Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
