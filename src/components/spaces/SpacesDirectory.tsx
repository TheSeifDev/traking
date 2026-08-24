"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Building2, CheckCircle2, Layers3, Loader2, Plus, RefreshCw, UsersRound, X } from "lucide-react";
import { useState } from "react";
import type { UserRole } from "@/src/types/auth";
import type { AccessibleOrganization, AccessibleSpace } from "@/src/types/space";
import type { ActiveSpaceContext } from "@/src/lib/spaces/active-space";
import { getSpaceDisplayName, isLegacyOrganizationContainerSpace } from "@/src/lib/spaces/labels";

function roleLabel(space: AccessibleSpace): string {
  if (space.is_platform_owner) return "Platform owner";
  return space.membership_role === "admin" ? "Space admin" : "Space member";
}

export default function SpacesDirectory({ spaces, organizations, role, activeSpaceId, activeSpaceContext }: { spaces: AccessibleSpace[]; organizations: AccessibleOrganization[]; role: UserRole; activeSpaceId: string | null; activeSpaceContext: ActiveSpaceContext }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("organization_id");
  const selectedOrganizationId = requestedOrganizationId && organizations.some((organization) => organization.id === requestedOrganizationId)
    ? requestedOrganizationId
    : organizations[0]?.id ?? "";
  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
  const visibleSpaces = spaces.filter((space) => space.organization_id === selectedOrganizationId && !isLegacyOrganizationContainerSpace(space, selectedOrganization?.name));
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCreate = role === "owner";
  const allSpacesActive = role === "owner" && activeSpaceContext.type === "all" && activeSpaceContext.organizationId === selectedOrganizationId;
  const [selectingAll, setSelectingAll] = useState(false);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || !selectedOrganizationId) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || undefined, organization_id: selectedOrganizationId }),
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

  function selectOrganization(nextId: string) {
    if (nextId) router.push(`/spaces?organization_id=${encodeURIComponent(nextId)}`);
  }

  async function selectAllSpaces() {
    if (!canCreate || !selectedOrganizationId || allSpacesActive || selectingAll) return;
    setSelectingAll(true);
    setError(null);
    try {
      const response = await fetch("/api/spaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", organization_id: selectedOrganizationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Unable to select All Spaces.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while selecting All Spaces.");
    } finally {
      setSelectingAll(false);
    }
  }

  return (
    <div className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1200px] space-y-7">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">TrackUp Spaces</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Spaces</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Choose a Space inside your Organization. Every video, viewer link, session, event, and analytics view is scoped to that Space.</p>
          </div>
          {canCreate && selectedOrganizationId && <button onClick={() => { setShowCreate((value) => !value); setError(null); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"><Plus size={16} />Create Space</button>}
        </header>

        {organizations.length > 0 && <section className="flex flex-col gap-3 rounded-2xl border border-white/9 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Organization</p><p className="mt-1 text-sm font-semibold text-white">{selectedOrganization?.name ?? "Select an Organization"}</p></div>{organizations.length > 1 && <select value={selectedOrganizationId} onChange={(event) => selectOrganization(event.target.value)} className="rounded-xl border border-white/10 bg-[#10102d] px-3 py-2 text-sm text-white/80 outline-none" aria-label="Select Organization">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>}</section>}

        {canCreate && selectedOrganization && <section className={`flex flex-col gap-4 rounded-3xl border p-5 shadow-[0_18px_65px_rgba(0,0,0,0.12)] sm:flex-row sm:items-center sm:justify-between ${allSpacesActive ? "border-violet-300/40 bg-violet-400/[0.08]" : "border-white/9 bg-white/[0.03]"}`}><div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><Layers3 size={21} /></span><div className="min-w-0"><p className="text-sm font-semibold text-white">All Spaces</p><p className="mt-1 text-xs leading-5 text-white/45">Organization-wide dashboard, video library, watch links, and analytics across every accessible child Space.</p></div></div><button type="button" onClick={() => void selectAllSpaces()} disabled={allSpacesActive || selectingAll} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${allSpacesActive ? "bg-emerald-400/10 text-emerald-200" : "bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-60"}`}>{allSpacesActive ? <><CheckCircle2 size={15} />Active</> : selectingAll ? <><Loader2 size={15} className="animate-spin" />Selecting…</> : <><Layers3 size={15} />View All Spaces</>}</button></section>}

        {showCreate && canCreate && selectedOrganizationId && <form onSubmit={handleCreate} className="rounded-3xl border border-violet-300/15 bg-violet-400/[0.06] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white">Create a TrackUp Space</p><p className="mt-1 text-xs leading-5 text-white/45">This Space will be created under {selectedOrganization?.name ?? "the selected Organization"}. ClickUp linking can be added from the Space settings flow.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Close create Space form"><X size={16} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/45">Space name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} placeholder="Product review" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-white outline-none focus:border-violet-300/45" /></label><label className="text-xs text-white/45">Slug <span className="text-white/25">(optional)</span><input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={98} placeholder="product-review" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-white outline-none focus:border-violet-300/45" /></label></div>{error && <p className="mt-4 text-sm text-red-200">{error}</p>}<button type="submit" disabled={creating} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#17172f] transition hover:bg-violet-50 disabled:opacity-50">{creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Create Space</button></form>}

        {visibleSpaces.length === 0 ? <EmptySpaces canCreate={canCreate && Boolean(selectedOrganizationId)} onCreate={() => setShowCreate(true)} hasOrganization={Boolean(selectedOrganization)} /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleSpaces.map((space) => <SpaceCard key={space.id} space={space} organization={selectedOrganization} active={space.id === activeSpaceId} />)}</div>}
      </div>
    </div>
  );
}

function SpaceCard({ space, organization, active }: { space: AccessibleSpace; organization: AccessibleOrganization | null; active: boolean }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectSpace() {
    if (active || selecting) return;
    setSelecting(true);
    setError(null);
    try {
      const response = await fetch("/api/spaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_id: space.id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Unable to select this Space.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while selecting this Space.");
    } finally {
      setSelecting(false);
    }
  }

  return <article className={`group flex min-h-60 flex-col justify-between rounded-3xl border p-5 shadow-[0_18px_65px_rgba(0,0,0,0.14)] transition ${active ? "border-violet-300/40 bg-violet-400/[0.08]" : "border-white/9 bg-white/[0.035] hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-white/[0.05]"}`}><div><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><Building2 size={21} /></span>{active ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200"><CheckCircle2 size={13} />Active</span> : <ArrowUpRight size={17} className="text-white/25 transition group-hover:text-violet-200" />}</div><h2 className="mt-6 truncate text-xl font-semibold text-white">{getSpaceDisplayName(space)}</h2><p className="mt-1 truncate text-xs text-white/35">/{space.slug}</p>{organization && <p className="mt-3 truncate text-xs text-white/45">Organization · {organization.name}</p>}</div><div className="mt-7 space-y-3 border-t border-white/8 pt-4"><div className="flex items-center justify-between gap-3 text-xs"><span className="text-white/38">Your access</span><span className="font-medium text-violet-200">{roleLabel(space)}</span></div><div className="flex items-center justify-between gap-3 text-xs"><span className="text-white/38">ClickUp link</span>{space.clickup_space_id ? <span className="inline-flex items-center gap-1 text-emerald-200/75"><CheckCircle2 size={13} />Connected</span> : <span className="text-white/35">Not linked</span>}</div><button type="button" onClick={selectSpace} disabled={active || selecting} className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? "cursor-default bg-emerald-400/10 text-emerald-200" : "bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-60"}`}>{active ? "Current Space" : selecting ? "Selecting…" : "Select Space"}</button>{error && <p className="text-xs text-red-200">{error}</p>}</div></article>;
}

function EmptySpaces({ canCreate, onCreate, hasOrganization }: { canCreate: boolean; onCreate: () => void; hasOrganization: boolean }) {
  return <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/[0.018] px-6 py-12 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><UsersRound size={24} /></div><h2 className="mt-5 text-xl font-semibold text-white">{hasOrganization ? "No accessible Spaces" : "No accessible Organizations"}</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/40">{hasOrganization ? "No active child Space is available for this Organization yet." : "Your account has no active organization membership yet."}</p>{canCreate ? <button onClick={onCreate} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"><Plus size={15} />Create your first Space</button> : <div className="mt-6 inline-flex items-center gap-2 text-xs text-white/35"><RefreshCw size={14} />Ask a Space admin to add you</div>}</div>;
}
