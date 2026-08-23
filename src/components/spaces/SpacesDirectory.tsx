"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Building2, CheckCircle2, Loader2, Plus, RefreshCw, UsersRound, X } from "lucide-react";
import type { UserRole } from "@/src/types/auth";
import type { AccessibleSpace } from "@/src/types/space";

function roleLabel(space: AccessibleSpace): string {
  if (space.is_platform_owner) return "Platform owner";
  return space.membership_role === "admin" ? "Space admin" : "Space member";
}

export default function SpacesDirectory({ spaces, role }: { spaces: AccessibleSpace[]; role: UserRole }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCreate = role === "owner";

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Unable to create Space.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error while creating the Space.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1200px] space-y-7">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Workspace organization</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Spaces</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Choose the Space you are working in. Every video, viewer link, session, event, and analytics view is scoped to its Space.</p>
          </div>
          {canCreate && <button onClick={() => { setShowCreate((value) => !value); setError(null); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"><Plus size={16} />Create Space</button>}
        </header>

        {showCreate && canCreate && <form onSubmit={handleCreate} className="rounded-3xl border border-violet-300/15 bg-violet-400/[0.06] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white">Create a TrackUp Space</p><p className="mt-1 text-xs leading-5 text-white/45">The platform owner becomes the first Space admin. ClickUp linking can be added from the Space settings flow.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Close create Space form"><X size={16} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/45">Space name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} placeholder="Product review" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-white outline-none focus:border-violet-300/45" /></label><label className="text-xs text-white/45">Slug <span className="text-white/25">(optional)</span><input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={98} placeholder="product-review" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-white outline-none focus:border-violet-300/45" /></label></div>{error && <p className="mt-4 text-sm text-red-200">{error}</p>}<button type="submit" disabled={creating} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#17172f] transition hover:bg-violet-50 disabled:opacity-50">{creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Create Space</button></form>}

        {spaces.length === 0 ? <EmptySpaces canCreate={canCreate} onCreate={() => setShowCreate(true)} /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{spaces.map((space) => <SpaceCard key={space.id} space={space} />)}</div>}
      </div>
    </div>
  );
}

function SpaceCard({ space }: { space: AccessibleSpace }) {
  return <Link href={`/spaces/${space.id}`} className="group flex min-h-60 flex-col justify-between rounded-3xl border border-white/9 bg-white/[0.035] p-5 shadow-[0_18px_65px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-white/[0.05]"><div><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><Building2 size={21} /></span><ArrowUpRight size={17} className="text-white/25 transition group-hover:text-violet-200" /></div><h2 className="mt-6 truncate text-xl font-semibold text-white">{space.name}</h2><p className="mt-1 truncate text-xs text-white/35">/{space.slug}</p></div><div className="mt-7 space-y-3 border-t border-white/8 pt-4"><div className="flex items-center justify-between gap-3 text-xs"><span className="text-white/38">Your access</span><span className="font-medium text-violet-200">{roleLabel(space)}</span></div><div className="flex items-center justify-between gap-3 text-xs"><span className="text-white/38">ClickUp link</span>{space.clickup_workspace_id ? <span className="inline-flex items-center gap-1 text-emerald-200/75"><CheckCircle2 size={13} />Connected</span> : <span className="text-white/35">Not linked</span>}</div></div></Link>;
}

function EmptySpaces({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/[0.018] px-6 py-12 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><UsersRound size={24} /></div><h2 className="mt-5 text-xl font-semibold text-white">No accessible Spaces</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/40">You are authenticated, but no active Space membership is available for this account yet.</p>{canCreate ? <button onClick={onCreate} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"><Plus size={15} />Create your first Space</button> : <div className="mt-6 inline-flex items-center gap-2 text-xs text-white/35"><RefreshCw size={14} />Ask a Space admin to add you</div>}</div>;
}
