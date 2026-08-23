"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle, Copy, ExternalLink, Link2, Loader2, Plus, ShieldCheck, XCircle } from "lucide-react";
import type { WatchLink } from "@/src/types/video";

interface WatchLinkPanelProps {
  videoId: string;
  existingLinks: WatchLink[];
  canManage: boolean;
  appOrigin: string;
  onLinksChange?: (links: WatchLink[]) => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

export default function WatchLinkPanel({ videoId, existingLinks: initial, canManage, appOrigin, onLinksChange }: WatchLinkPanelProps) {
  const [links, setLinks] = useState<WatchLink[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());

  const getUrl = (token: string) => `${appOrigin}/watch/${token}`;
  const activeLink = links.find((link) => !link.revoked_at && !(link.expires_at && new Date(link.expires_at).getTime() <= currentTime));
  const historyLinks = links.filter((link) => link.id !== activeLink?.id);
  const revokedLinks = historyLinks.filter((link) => Boolean(link.revoked_at));

  function commitLinks(nextLinks: WatchLink[]) {
    setLinks(nextLinks);
    onLinksChange?.(nextLinks);
  }

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
      const link = data.watch_link as (WatchLink & { url?: string; reused?: boolean }) | undefined;
      if (!link || typeof link.id !== "string" || typeof link.token !== "string") {
        setError("The server did not return a valid watch link.");
        return;
      }
      const nextLinks = [link, ...links.filter((item) => item.id !== link.id)];
      commitLinks(nextLinks);
      const url = typeof link.url === "string" ? link.url : getUrl(link.token);
      try {
        await navigator.clipboard.writeText(url);
        setNotice(data.watch_link.reused ? "The active TrackUp viewer link was copied." : "Watch link created and copied to your clipboard.");
      } catch {
        setNotice("Watch link created. Copy it from the active link card.");
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
      const nextLinks = links.map((link) => link.id === linkId ? { ...link, revoked_at: new Date().toISOString() } : link);
      commitLinks(nextLinks);
      setNotice("Watch link revoked. New viewer sessions are now blocked.");
    } catch {
      setError("Network error while revoking the watch link.");
    } finally {
      setRevoking(null);
    }
  }

  async function copyLink(link: WatchLink) {
    setError(null);
    try {
      await navigator.clipboard.writeText(getUrl(link.token));
      setCopied(true);
      setNotice("Watch link copied.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copy failed. Select the active link manually instead.");
    }
  }

  return (
    <section className="space-y-4" aria-label="Viewer access management">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white"><Link2 size={15} className="text-violet-400" />Viewer access</h2>
          <p className="mt-1 text-xs leading-5 text-white/35">One active TrackUp viewer link per video. Revoke access at any time; previous links remain available in audit history.</p>
        </div>
        {canManage && <button onClick={() => void handleGenerate()} disabled={generating} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-600/15 px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-600/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{generating ? <Loader2 size={14} className="animate-spin" /> : activeLink ? <Copy size={14} /> : <Plus size={14} />}{generating ? "Checking..." : activeLink ? "Copy active link" : "Generate viewer link"}</button>}
      </div>

      {(error || notice) && <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${error ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>{error ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle size={15} className="mt-0.5 shrink-0" />}<span>{error ?? notice}</span></div>}

      {!canManage && <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs text-white/40">You have read-only access. An owner or admin can create or revoke viewer links.</div>}

      {activeLink ? <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Active</span><span className="text-[11px] text-white/35">TrackUp viewer access</span></div><p className="mt-3 break-all rounded-xl border border-white/8 bg-black/15 px-3 py-2.5 font-mono text-xs leading-5 text-emerald-100/85">{getUrl(activeLink.token)}</p></div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row"><button onClick={() => void copyLink(activeLink)} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white sm:w-auto">{copied ? <CheckCircle size={14} className="text-emerald-300" /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}</button><a href={getUrl(activeLink.token)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white sm:w-auto"><ExternalLink size={14} />Open</a>{canManage && <button onClick={() => void handleRevoke(activeLink.id)} disabled={revoking === activeLink.id} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-red-300/15 bg-red-400/[0.06] px-3 py-2 text-xs font-medium text-red-200/80 transition hover:bg-red-400/10 hover:text-red-100 disabled:opacity-50 sm:w-auto">{revoking === activeLink.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}Revoke</button>}</div>
        </div>
        <div className="mt-4 grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-4"><UsageStat label="Created" value={formatDate(activeLink.created_at)} /><UsageStat label="First opened" value={formatDate(activeLink.first_opened_at)} /><UsageStat label="Last accessed" value={formatDate(activeLink.last_accessed_at)} /><UsageStat label="Sessions" value={String(activeLink.session_count ?? 0)} /></div>
      </div> : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.018] p-6 text-center"><Link2 size={24} className="mx-auto text-white/20" /><p className="mt-3 text-sm font-medium text-white/60">No active viewer link</p><p className="mt-1 text-xs leading-5 text-white/30">Generate a secure TrackUp URL to let viewers watch inside the app.</p>{canManage && <button onClick={() => void handleGenerate()} disabled={generating} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50 sm:w-auto">{generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Generate viewer link</button>}</div>}

      {historyLinks.length > 0 && <details className="group rounded-2xl border border-white/8 bg-white/[0.018]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-white/65 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300/50"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-white/35" />Revoked history <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/40">{revokedLinks.length}</span></span><span className="text-xs text-white/30 transition group-open:rotate-180">⌄</span></summary>
        <div className="space-y-2 border-t border-white/8 p-3">{historyLinks.map((link) => { const expired = Boolean(link.expires_at && new Date(link.expires_at).getTime() <= currentTime); return <div key={link.id} className="flex flex-col gap-3 rounded-xl border border-white/6 bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${link.revoked_at ? "bg-red-400/10 text-red-200" : "bg-amber-400/10 text-amber-200"}`}>{link.revoked_at ? "Revoked" : expired ? "Expired" : "Inactive"}</span><span className="text-[11px] text-white/30">Previous viewer link</span></div><p className="mt-2 text-xs text-white/40">Created {formatDate(link.created_at)}{link.revoked_at ? ` · Revoked ${formatDate(link.revoked_at)}` : ""}</p><p className="mt-1 text-[11px] text-white/28">{link.session_count ?? 0} recorded sessions · link URL hidden from active access controls</p></div><Link href={`/videos/${videoId}?tab=activity`} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-xs text-white/50 transition hover:border-white/15 hover:text-white sm:w-auto">View audit <ExternalLink size={13} /></Link></div>; })}</div>
      </details>}
    </section>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.12em] text-white/28">{label}</p><p className="mt-1 truncate text-xs text-white/60">{value}</p></div>;
}
