"use client";
/**
 * WatchLinkPanel - shows existing watch links and lets user create/copy/revoke links
 */
import { useState } from "react";
import { Link2, Copy, CheckCircle, Plus, ExternalLink, XCircle } from "lucide-react";
import type { WatchLink } from "@/src/types/video";

interface WatchLinkPanelProps {
  videoId: string;
  existingLinks: WatchLink[];
}

export default function WatchLinkPanel({ videoId, existingLinks: initial }: WatchLinkPanelProps) {
  const [links, setLinks] = useState<WatchLink[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/watch-link`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      const link = data.watch_link as WatchLink | undefined;
      if (link && typeof link.id === "string" && typeof link.token === "string") {
        setLinks((prev) => [link, ...prev]);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(linkId: string) {
    setRevoking(linkId);
    try {
      const res = await fetch(`/api/videos/${videoId}/watch-link`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: linkId }),
      });
      if (!res.ok) return;
      setLinks((prev) =>
        prev.map((link) =>
          link.id === linkId ? { ...link, revoked_at: new Date().toISOString() } : link,
        ),
      );
    } finally {
      setRevoking(null);
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
            const expired = Boolean(link.expires_at && new Date(link.expires_at) <= new Date());
            const inactive = Boolean(link.revoked_at || expired);
            return (
              <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
                <code className={`flex-1 text-xs truncate font-mono ${inactive ? "text-white/30" : "text-violet-300"}`}>
                  {url}
                </code>
                <div className="flex items-center gap-2 shrink-0">
                  {link.revoked_at ? (
                    <span className="text-xs text-red-300">Revoked</span>
                  ) : expired ? (
                    <span className="text-xs text-amber-300">Expired</span>
                  ) : (
                    <>
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
                    </>
                  )}
                  {!link.revoked_at && (
                    <button
                      onClick={() => void handleRevoke(link.id)}
                      disabled={revoking === link.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-300 transition-all disabled:opacity-50"
                      title="Revoke link"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
