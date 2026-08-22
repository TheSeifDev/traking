"use client";
/**
 * WatchLinkPanel - shows existing watch links and lets user create/copy new ones
 */
import { useState } from "react";
import { Link2, Copy, CheckCircle, Plus, ExternalLink } from "lucide-react";
import type { WatchLink } from "@/src/types/video";

interface WatchLinkPanelProps {
  videoId: string;
  existingLinks: WatchLink[];
}

export default function WatchLinkPanel({ videoId, existingLinks: initial }: WatchLinkPanelProps) {
  const [links, setLinks] = useState<WatchLink[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/watch-link`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.watch_link) {
        setLinks((prev) => [
          { id: data.watch_link.id, video_id: videoId, token: data.watch_link.token, created_by: null, expires_at: null, created_at: new Date().toISOString() },
          ...prev,
        ]);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink(token: string) {
    const url = `${appUrl}/watch/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Link2 size={15} className="text-violet-400" />
          Watch Links
        </h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/20 transition-all disabled:opacity-50"
        >
          <Plus size={13} />
          {generating ? "Generating..." : "New Link"}
        </button>
      </div>

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
          <p className="text-white/40 text-sm">No watch links yet. Generate one to share this video.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const url = `${appUrl}/watch/${link.token}`;
            return (
              <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
                <code className="flex-1 text-xs text-violet-300 truncate font-mono">{url}</code>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyLink(link.token)}
                    className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all"
                    title="Copy link"
                  >
                    {copied === link.token ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all"
                    title="Open in new tab"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}