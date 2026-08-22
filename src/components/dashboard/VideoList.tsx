"use client";
/**
 * Video List — client component for the /videos page
 * Handles create, delete, search, and share within the browser.
 */
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Video, Search, Link2, Trash2, Eye, CheckCircle } from "lucide-react";
import CreateVideoDialog from "@/src/components/dashboard/CreateVideoDialog";
import type { Video as VideoType } from "@/src/types/video";

const SOURCE_LABELS: Record<string, string> = {
  youtube: "YouTube",
  google_drive: "Google Drive",
  vimeo: "Vimeo",
  telegram: "Telegram",
  direct_url: "Direct URL",
};

export default function VideoList() {
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/videos");
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchVideos(); }, [fetchVideos]);

  const filtered = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string) {
    if (!confirm("Delete this video and all its watch data?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/videos/${id}`, { method: "DELETE" });
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  async function handleShare(id: string) {
    try {
      const res = await fetch(`/api/videos/${id}/watch-link`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      const url = data.watch_link?.url;
      if (url) {
        await navigator.clipboard.writeText(url);
        setShareCopied(id);
        setTimeout(() => setShareCopied(null), 2500);
        void fetchVideos();
      }
    } catch {
      alert("Failed to generate watch link.");
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Videos</h1>
        <CreateVideoDialog onCreated={fetchVideos} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/40 transition-all"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white/4 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center text-center">
          <Video size={36} className="text-white/15 mb-4" />
          <p className="text-white/40 text-sm">
            {search ? `No videos match "${search}"` : "No videos yet. Click Add Video to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/4 border border-white/8 hover:border-white/12 transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                <Video size={16} className="text-violet-400" />
              </div>

              <div className="flex-1 min-w-0">
                <Link href={`/videos/${v.id}`} className="text-sm font-medium text-white hover:text-violet-300 transition-colors truncate block">
                  {v.title}
                </Link>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-white/40 capitalize">{SOURCE_LABELS[v.source_type] ?? v.source_type}</span>
                  {v.clickup_tasks && v.clickup_tasks.length > 0 && (
                    <span className="text-xs text-blue-400">{v.clickup_tasks[0].clickup_task_name ?? "ClickUp task"}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center hidden sm:block">
                  <p className="text-sm font-semibold text-white">{v.view_count ?? 0}</p>
                  <p className="text-[11px] text-white/40">views</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-sm font-semibold text-white">{v.avg_completion ?? 0}%</p>
                  <p className="text-[11px] text-white/40">avg</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link href={`/videos/${v.id}`} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/6 transition-all" title="View analytics">
                    <Eye size={15} />
                  </Link>
                  <button
                    onClick={() => handleShare(v.id)}
                    className="p-2 rounded-lg text-white/30 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                    title="Copy watch link"
                  >
                    {shareCopied === v.id ? <CheckCircle size={15} className="text-green-400" /> : <Link2 size={15} />}
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    disabled={deleting === v.id}
                    className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                    title="Delete video"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
