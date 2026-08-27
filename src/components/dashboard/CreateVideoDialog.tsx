"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowUpRight, CheckCircle2, Copy, Link2, Loader2, Plus, X } from "lucide-react";
import type { VideoSourceType, Video } from "@/src/types/video";
import { VIDEO_SOURCE_TYPES } from "@/src/types/video";

interface ScopeOption {
  id: string;
  name: string;
}

interface CreateVideoDialogProps {
  onCreated: () => void | Promise<void>;
  organizationId: string | null;
  initialSpaceId?: string | null;
  scopeOptions: ScopeOption[];
  allowAllSpaces: boolean;
}

const SOURCE_LABELS: Record<VideoSourceType, string> = {
  youtube: "YouTube",
  google_drive: "Google Drive",
  vimeo: "Vimeo",
  telegram: "Telegram",
  direct_url: "Direct URL",
};

const SOURCE_PLACEHOLDERS: Record<VideoSourceType, string> = {
  youtube: "https://www.youtube.com/watch?v=...",
  google_drive: "https://drive.google.com/file/d/.../view",
  vimeo: "https://vimeo.com/...",
  telegram: "https://t.me/...",
  direct_url: "https://cdn.example.com/video.mp4",
};

type CreatedScope = { organizationId: string; spaceId: string | null };
type CreatedLink = { url: string; token: string };

function scopeQuery(scope: CreatedScope): string {
  return scope.spaceId
    ? `?space_id=${encodeURIComponent(scope.spaceId)}`
    : `?organization_id=${encodeURIComponent(scope.organizationId)}`;
}

export default function CreateVideoDialog({ onCreated, organizationId, initialSpaceId = null, scopeOptions, allowAllSpaces }: CreateVideoDialogProps) {
  const defaultScope = initialSpaceId ? `space:${initialSpaceId}` : "all";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdVideo, setCreatedVideo] = useState<Video | null>(null);
  const [createdScope, setCreatedScope] = useState<CreatedScope | null>(null);
  const [createdLink, setCreatedLink] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedScope, setSelectedScope] = useState(defaultScope);
  const [form, setForm] = useState({
    title: "",
    source_type: "youtube" as VideoSourceType,
    source_url: "",
    description: "",
  });

  function reset() {
    setError(null);
    setNotice(null);
    setCreatedVideo(null);
    setCreatedScope(null);
    setCreatedLink(null);
    setCopied(false);
    setSelectedScope(defaultScope);
    setForm({ title: "", source_type: "youtube", source_url: "", description: "" });
  }

  function close() {
    if (loading || linkLoading) return;
    setOpen(false);
    reset();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function selectedScopeValue(): CreatedScope | null {
    if (!organizationId) return null;
    if (selectedScope === "all") return { organizationId, spaceId: null };
    const [, spaceId] = selectedScope.split(":");
    return spaceId ? { organizationId, spaceId } : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const scope = selectedScopeValue();
    if (!scope) {
      setError("Choose an authorized Organization/Space scope before creating the video.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/videos${scopeQuery(scope)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({})) as { video?: Video; scope?: { organization_id?: unknown; space_id?: unknown }; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create video.");
        return;
      }
      if (!data.video?.id || typeof data.scope?.organization_id !== "string") {
        setError("The server did not return the created video scope.");
        return;
      }
      const persistedScope: CreatedScope = {
        organizationId: data.scope.organization_id,
        spaceId: typeof data.scope.space_id === "string" ? data.scope.space_id : null,
      };
      setCreatedVideo(data.video);
      setCreatedScope(persistedScope);
      setNotice("Video created and persisted. Create a viewer link to start collecting activity.");
      await onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateLink() {
    if (!createdVideo || !createdScope) return;
    setLinkLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/videos/${createdVideo.id}/watch-link${scopeQuery(createdScope)}`, { method: "POST" });
      const data = await res.json().catch(() => ({})) as { watch_link?: { url?: unknown; token?: unknown }; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to create a viewer link.");
        return;
      }
      const url = data.watch_link?.url;
      const token = data.watch_link?.token;
      if (typeof url !== "string" || typeof token !== "string") {
        setError("The server did not return a valid viewer link.");
        return;
      }
      setCreatedLink({ url, token });
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setNotice("Viewer link created and copied. Share it to collect real viewer activity.");
      } catch {
        setNotice("Viewer link created. Copy it from the link field before sharing.");
      }
      await onCreated();
    } catch {
      setError("Network error while creating the viewer link.");
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(124,58,237,0.28)] transition hover:bg-violet-400 active:scale-[0.98]"
      >
        <Plus size={16} />
        Add video
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
          <div className="absolute inset-0 bg-[#070720]/80 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 my-auto w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b0b28] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">Create tracking asset</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{createdVideo ? "Video created" : "Add video"}</h2>
                <p className="mt-2 text-sm leading-6 text-white/45">{createdVideo ? "Your video is persisted. Create a private TrackUp viewer link as the next step." : "Choose where this video belongs, then add a provider-backed source."}</p>
              </div>
              <button onClick={close} className="rounded-xl p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white" aria-label="Close Add Video dialog"><X size={17} /></button>
            </div>

            {(error || notice) && <div className={`mt-5 flex items-start gap-2 rounded-2xl border px-3.5 py-3 text-xs leading-5 ${error ? "border-red-300/20 bg-red-400/[0.08] text-red-100" : "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100"}`}>{error ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}<span>{error ?? notice}</span></div>}

            {createdVideo && createdScope ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                  <p className="text-xs font-semibold text-white">{createdVideo.title}</p>
                  <p className="mt-1 text-xs text-white/40">{SOURCE_LABELS[createdVideo.source_type]} · {createdScope.spaceId ? "Real Space scope" : "All Spaces virtual Organization scope"}</p>
                </div>
                {createdLink ? (
                  <div className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.07] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200/80">Viewer link ready</p>
                    <p className="mt-3 truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-xs text-white/75">{createdLink.url}</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button onClick={() => void navigator.clipboard.writeText(createdLink.url).then(() => { setCopied(true); setNotice("Viewer link copied."); }).catch(() => setError("Copy failed. Select the link manually."))} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400"><Copy size={14} />{copied ? "Copied" : "Copy link"}</button>
                      <a href={createdLink.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-medium text-white/75 transition hover:border-white/20 hover:text-white"><ArrowUpRight size={14} />Open viewer</a>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => void handleCreateLink()} disabled={linkLoading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">{linkLoading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}{linkLoading ? "Creating viewer link..." : "Create viewer link"}</button>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link href={`/videos/${createdVideo.id}${scopeQuery(createdScope)}`} onClick={close} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white">View video details <ArrowUpRight size={14} /></Link>
                  {!createdLink && <button onClick={close} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-white/55 transition hover:border-white/20 hover:text-white">Create link later</button>}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/55">Tracking scope *</label>
                  <select value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)} required className="block w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-300/50">
                    {allowAllSpaces && organizationId && <option value="all" className="bg-[#0b0b28]">All Spaces · Organization-wide</option>}
                    {scopeOptions.map((space) => <option key={space.id} value={`space:${space.id}`} className="bg-[#0b0b28]">{space.name}</option>)}
                  </select>
                  <p className="mt-1.5 text-[11px] leading-5 text-white/35">All Spaces is a virtual Organization scope. Specific options use the selected real Space relationship.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/55">Title *</label>
                  <input name="title" value={form.title} onChange={handleChange} required maxLength={255} placeholder="My video title" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-300/50" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/55">Provider *</label>
                  <select name="source_type" value={form.source_type} onChange={handleChange} className="block w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-300/50">
                    {VIDEO_SOURCE_TYPES.map((type) => <option key={type} value={type} className="bg-[#0b0b28]">{SOURCE_LABELS[type]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/55">Video URL *</label>
                  <input name="source_url" value={form.source_url} onChange={handleChange} required placeholder={SOURCE_PLACEHOLDERS[form.source_type]} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-300/50" />
                  <p className="mt-1.5 text-[11px] text-white/35">The server validates the URL for the selected provider before persistence.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/55">Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Optional description..." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-300/50" />
                </div>
                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <button type="button" onClick={close} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:border-white/20 hover:text-white">Cancel</button>
                  <button type="submit" disabled={loading || !organizationId || (!allowAllSpaces && scopeOptions.length === 0)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{loading ? "Creating..." : "Create video"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
