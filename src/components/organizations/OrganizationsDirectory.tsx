"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, CheckCircle2, UsersRound } from "lucide-react";
import type { AccessibleOrganization } from "@/src/types/space";

function roleLabel(organization: AccessibleOrganization): string {
  if (organization.is_platform_owner) return "Platform owner";
  return organization.membership_role === "admin" ? "Organization admin" : "Organization member";
}

export default function OrganizationsDirectory({ organizations }: { organizations: AccessibleOrganization[] }) {
  return (
    <div className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1200px] space-y-7">
        <header className="border-b border-white/8 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Tenant hierarchy</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Organizations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Organizations contain Spaces. Access is controlled by persisted TrackUp memberships; ClickUp is an optional identity and synchronization relationship.</p>
        </header>
        {organizations.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/[0.018] px-6 py-12 text-center">
            <UsersRound size={24} className="text-violet-200" />
            <h2 className="mt-5 text-xl font-semibold text-white">No accessible Organizations</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/40">Your account has no active organization membership yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {organizations.map((organization) => (
              <Link key={organization.id} href={`/organizations/${organization.id}`} className="group flex min-h-60 flex-col justify-between rounded-3xl border border-white/9 bg-white/[0.035] p-5 shadow-[0_18px_65px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-white/[0.05]">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><Building2 size={21} /></span>
                    <ArrowUpRight size={17} className="text-white/25 transition group-hover:text-violet-200" />
                  </div>
                  <h2 className="mt-6 truncate text-xl font-semibold text-white">{organization.name}</h2>
                  <p className="mt-1 truncate text-xs text-white/35">/{organization.slug}</p>
                </div>
                <div className="mt-7 space-y-3 border-t border-white/8 pt-4">
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="text-white/38">Your access</span><span className="font-medium text-violet-200">{roleLabel(organization)}</span></div>
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="text-white/38">ClickUp relationship</span>{organization.clickup_workspace_id ? <span className="inline-flex items-center gap-1 text-emerald-200/75"><CheckCircle2 size={13} />Linked</span> : <span className="text-white/35">Optional</span>}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
