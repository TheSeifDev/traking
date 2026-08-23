"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Copy, ExternalLink, Link2, Plus, XCircle } from "lucide-react";
import type { WatchLink } from "@/src/types/video";

interface WatchLinkPanelProps {
  videoId: string;
  existingLinks: WatchLink[];
  canManage: boolean;
  appOrigin: string;
}

export default function WatchLinkPanel({ videoId, existingLinks: initial, canManage, appOrigin }: WatchLinkPanelProps) {
  const [links, setLinks] = useState<WatchLink[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime] = useState(() => new Date().getTime());

  const getUrl = (token: string) => `${appOrigin}/watch/${token}`;
  const activeLink = links.find((link) => !link.revoked_at && !(link.expires_at && new Date(link.expires_at).getTime() <= currentTime));

  async function handleGenerate() {
    if (!canManage) return;
    setGenerating(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/watch-link`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to generate a watch link.");
        return;
      }
      const link = data.watch_link as WatchLink | undefined;
      if (!link || typeof link.id !== "string" || typeof link.token !== "string") {
        setError("The server did not return a valid watch link.");
        return;
      }
      setLinks((current) => {
        const alreadyLoaded = current.some((item) => item.id === link.id);
        return alreadyLoaded ? current.map((item) => item.id === link.id ? { ...item, ...link } : item) : [link, ...current];
      });
      const url = typeof data.watch_link.url === "string" ? data.watch_link.url : getUrl(link.token);
      try {
        await navigator.clipboard.writeText(url);
        setNotice(data.watch_link.reused ? "The active TrackUp viewer link was copied." : "Watch link created and copied to your clipboard.");
      } catch {
        setNotice("Watch link created. Copy it from the list below.");
      }
    } catch {
      setError("Network error while generating the watch link.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(linkId: string) {
    if (!canManage || !window.confirm("Revoke this link? New sessions will be rejected, while existing analytics remain available.")) return;
    setRevoking(linkId);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/watch-link`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: linkId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to revoke this link.");
        return;
      }
      setLinks((current) => current.map((link) => link.id === linkId ? { ...link, revoked_at: new Date().toISOString() } : link));
      setNotice("Watch link revoked. New viewer sessions are now blocked.");
    } catch {
      setError("Network error while revoking the watch link.");
    } finally {
      setRevoking(null);
    }
  }

  async function copyLink(token: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(getUrl(token));
      setCopied(token);
      setNotice("Watch link copied.");
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      setError("Copy failed. Select the link manually instead.");
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white"><Link2 size={15} className="text-violet-400" />Viewer access</h2>
          <p className="mt-1 text-xs text-white/35">One active TrackUp viewer link per video. Revoke access at any time; historical revoked links remain visible for audit.</p>
        </div>
        {canManage && <button onClick={() => void handleGenerate()} disabled={generating} className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-600/15 px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-600/25 disabled:opacity-50"><>{activeLink ? <Copy size={14} /> : <Plus size={14} />}{generating ? "Checking..." : activeLink ? "Copy active link" : "Create viewer link"}</></button>}
      </div>

      {(error || notice) && <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${error ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>{error ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle size={15} className="mt-0.5 shrink-0" />}<span>{error ?? notice}</span></div>}

      {!canManage && <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs text-white/40">You have read-only access. An owner or admin can create or revoke viewer links.</div>}

      {links.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center"><Link2 size={25} className="mx-auto mb-2 text-white/15" /><p className="text-sm text-white/40">No viewer links yet.</p><p className="mt-1 text-xs text-white/25">Create a link to open the video inside TrackUp.</p></div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const url = getUrl(link.token);
            const expired = Boolean(link.expires_at && new Date(link.expires_at).getTime() <= currentTime);
            const inactive = Boolean(link.revoked_at || expired);
            return <div key={link.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${inactive ? "border-white/6 bg-white/[0.02]" : "border-white/8 bg-white/[0.035]"}`}>
              <div className="min-w-0 flex-1"><p className={`truncate font-mono text-xs ${inactive ? "text-white/25 line-through" : "text-violet-200"}`}>{url}</p><p className="mt-1 text-[11px] text-white/30">Created {new Date(link.created_at).toLocaleString()}</p></div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {link.revoked_at ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-200">Revoked</span> : expired ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Expired</span> : <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">Active</span>}
                {!inactive && <><button onClick={() => void copyLink(link.token)} className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white" title="Copy viewer link">{copied === link.token ? <CheckCircle size={14} className="text-emerald-300" /> : <Copy size={14} />}</button><a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white" title="Open TrackUp viewer"><ExternalLink size={14} /></a></>}
                {canManage && !link.revoked_at && <button onClick={() => void handleRevoke(link.id)} disabled={revoking === link.id} className="rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50" title="Revoke viewer link"><XCircle size={14} /></button>}
              </div>
            </div>;
          })}
        </div>
      )}
    </section>
  );
}
