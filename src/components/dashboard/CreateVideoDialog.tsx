"use client";
/**
 * Create Video Dialog
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { VideoSourceType } from "@/src/types/video";
import { VIDEO_SOURCE_TYPES } from "@/src/types/video";

interface CreateVideoDialogProps {
  onCreated: () => void;
  spaceId?: string | null;
}

const SOURCE_LABELS: Record<VideoSourceType, string> = {
  youtube: "YouTube",
  google_drive: "Google Drive",
  vimeo: "Vimeo",
  telegram: "Telegram",
  direct_url: "Direct URL",
};

export default function CreateVideoDialog({ onCreated, spaceId }: CreateVideoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    source_type: "youtube" as VideoSourceType,
    source_url: "",
    description: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = spaceId ? `/api/videos?space_id=${encodeURIComponent(spaceId)}` : "/api/videos";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create video.");
        return;
      }
      setOpen(false);
      setForm({ title: "", source_type: "youtube", source_url: "", description: "" });
      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
      >
        <Plus size={15} />
        Add Video
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-[#0f0f2a] border border-white/10 shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Add Video</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  maxLength={255}
                  placeholder="My video title"
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all placeholder:text-white/25"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Source</label>
                <select
                  name="source_type"
                  value={form.source_type}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-violet-500/50 transition-all"
                >
                  {VIDEO_SOURCE_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-[#0f0f2a]">{SOURCE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">URL *</label>
                <input
                  name="source_url"
                  value={form.source_url}
                  onChange={handleChange}
                  required
                  placeholder="https://..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all placeholder:text-white/25"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all resize-none placeholder:text-white/25"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:text-white hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-all"
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}