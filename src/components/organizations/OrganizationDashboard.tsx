"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, Building2, LayoutDashboard, Settings2, UsersRound } from "lucide-react";
import type { Organization, OrganizationMember, Space } from "@/src/types/space";
import { getSpaceDisplayName, isLegacyOrganizationContainerSpace } from "@/src/lib/spaces/labels";

export default function OrganizationDashboard({ organization, spaces, membership, isPlatformOwner }: { organization: Organization; spaces: Space[]; membership: OrganizationMember | null; isPlatformOwner: boolean }) {
  const canManage = isPlatformOwner || membership?.role === "admin";
  const selectableSpaces = spaces.filter((space) => !isLegacyOrganizationContainerSpace(space, organization.name));
  return (
    <div className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1200px] space-y-7">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/organizations" className="text-xs text-violet-300 hover:text-violet-200">← Organizations</Link>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Organization</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">{organization.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">This is an Organization, not a Space. Spaces are the operational boundary for videos, viewer links, sessions, events, and analytics.</p><p className="mt-3 break-all text-[11px] text-white/30">Organization ID · {organization.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">{canManage && <Link href={`/organizations/${organization.id}/members`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:border-violet-300/30 hover:text-white"><UsersRound size={16} />Manage members</Link>}<Link href={`/organizations/${organization.id}/analytics`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:border-violet-300/30 hover:text-white"><BarChart3 size={16} />Analytics</Link><Link href={`/organizations/${organization.id}/settings`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:border-violet-300/30 hover:text-white"><Settings2 size={16} />Settings</Link></div>
        </header>
        <section className="grid gap-4 sm:grid-cols-3">
          <Summary label="Spaces" value={selectableSpaces.length} icon={LayoutDashboard} />
          <Summary label="Access" value={isPlatformOwner ? "Owner" : membership?.role === "admin" ? "Admin" : "Member"} icon={UsersRound} />
          <Summary label="ClickUp" value={organization.clickup_workspace_id ? "Linked" : "Optional"} icon={Building2} />
        </section>
        <section>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Operational spaces</p><h2 className="mt-2 text-xl font-semibold text-white">Spaces in this organization</h2></div>{canManage && <Link href={`/organizations/${organization.id}/spaces`} className="text-xs font-medium text-violet-300 hover:text-violet-200">Create or manage</Link>}</div>
          {selectableSpaces.length === 0 ? <div className="rounded-3xl border border-dashed border-white/12 p-10 text-center text-sm text-white/40">No mapped child Spaces are attached to this Organization yet.</div> : <div className="grid gap-4 md:grid-cols-2">{selectableSpaces.map((space) => { return <Link key={space.id} href={`/spaces/${space.id}`} className="group rounded-3xl border border-white/9 bg-white/[0.035] p-5 transition hover:border-violet-300/25 hover:bg-white/[0.05]"><div className="flex items-start justify-between gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"><LayoutDashboard size={18} /></div><ArrowUpRight size={16} className="text-white/25 group-hover:text-violet-200" /></div><h3 className="mt-5 text-lg font-semibold text-white">{getSpaceDisplayName(space)}</h3><p className="mt-1 text-xs text-white/35">/{space.slug}</p><p className="mt-5 text-xs text-white/45">Space inside {organization.name} · Open Space dashboard</p></Link>; })}</div>}
        </section>
      </div>
    </div>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Building2 }) {
  return <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"><Icon size={17} className="text-violet-200" /><p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-white/35">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p></article>;
}
