"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2, Search, ShieldCheck, UserPlus, UserRound, UserX, UsersRound } from "lucide-react";
import type { SpaceMemberCandidate, SpaceMemberView } from "@/src/lib/spaces/service";
import { confirmAction, notify } from "@/src/components/feedback/TrackUpFeedbackProvider";

function displayName(member: SpaceMemberView): string {
  return member.profile.name?.trim() || member.profile.email;
}

function organizationRole(member: SpaceMemberView): string {
  if (member.organization_role === "owner") return "OWNER";
  if (member.organization_role === "admin") return "ADMIN";
  if (member.organization_role === "member") return "MEMBER";
  return "UNKNOWN";
}

function organizationRoleClasses(role: string): string {
  if (role === "OWNER") return "bg-amber-400/10 text-amber-200";
  if (role === "ADMIN") return "bg-violet-400/10 text-violet-200";
  return "bg-white/[0.06] text-white/65";
}

function spaceRole(member: SpaceMemberView): string {
  return member.role === "admin" ? "TEAM ADMIN" : "TEAM MEMBER";
}

function errorCopy(value: unknown): string {
  if (typeof value !== "string") return "The request could not be completed.";
  const messages: Record<string, string> = {
    forbidden: "You do not have Team admin access.",
    membership_exists: "This profile is already an active Team member.",
    member_not_found: "The profile is not available for this action.",
    last_admin_required: "Keep at least one active Team admin before changing this member.",
    cannot_modify_owner: "The platform owner cannot be changed from Team membership.",
    cannot_modify_self: "You cannot change or remove your own Team membership.",
    organization_mismatch: "The profile must belong to this Organization before Team access can be assigned.",
  };
  return messages[value] ?? value;
}

export default function SpaceMembersManager({ spaceId, initialMembers }: { spaceId: string; initialMembers: SpaceMemberView[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SpaceMemberCandidate[]>([]);
  const [selectedRole, setSelectedRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    setNotice(null);
    if (query.trim().length < 2) {
      setCandidates([]);
      return;
    }
    setBusy("search");
    try {
      const response = await fetch(`/api/spaces/${spaceId}/member-candidates?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorCopy(data.error));
        return;
      }
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
    } catch {
      setError("Network error while searching profiles.");
    } finally {
      setBusy(null);
    }
  }

  async function add(profileId: string) {
    setBusy(profileId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/spaces/${spaceId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile_id: profileId, role: selectedRole }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorCopy(data.error));
        return;
      }
      if (data.member) setMembers((current) => [...current, data.member as SpaceMemberView]);
      setCandidates((current) => current.filter((candidate) => candidate.id !== profileId));
      setNotice("The member was added to this Space.");
    } catch {
      setError("Network error while adding the member.");
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(member: SpaceMemberView) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    setBusy(member.profile_id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/spaces/${spaceId}/members/${member.profile_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: nextRole }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorCopy(data.error));
        return;
      }
      if (data.member) setMembers((current) => current.map((item) => item.profile_id === member.profile_id ? data.member as SpaceMemberView : item));
      setNotice(`Updated ${displayName(member)} to Space ${nextRole}. Organization role was not changed.`);
    } catch {
      notify.error("Network error", "Could not update the member role.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(member: SpaceMemberView) {
    const confirmed = await confirmAction({
      title: `Remove ${displayName(member)} from this Space?`,
      body: "Their TrackUp account and historical tracking remain intact. Only Space access will be removed.",
      confirmLabel: "Remove from Space",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusy(member.profile_id);
    try {
      const response = await fetch(`/api/spaces/${spaceId}/members/${member.profile_id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorCopy(data.error));
        return;
      }
      setMembers((current) => current.filter((item) => item.profile_id !== member.profile_id));
      setNotice(`${displayName(member)} no longer has access to this Space. Their Organization role and historical tracking remain intact.`);
    } catch {
      notify.error("Network error", "Could not remove the member.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1200px] space-y-7">
        <header className="flex flex-col gap-4 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href={`/spaces/${spaceId}`} className="inline-flex items-center gap-1.5 text-xs text-white/38 transition hover:text-violet-200"><ArrowLeft size={14} />Back to Team</Link>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Team members</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white">Team access</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Manage access to this Team only. Organization roles remain the source of truth for Organization authority and are never changed by Team membership.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/9 bg-white/[0.03] px-3 py-2 text-xs text-white/45"><ShieldCheck size={15} className="text-violet-300" />Server-side Team controls</div>
          </div>
        </header>

        {(error || notice) && <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-300/20 bg-red-400/[0.08] text-red-100" : "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100"}`}>{error ?? notice}</div>}

        <section className="rounded-3xl border border-white/9 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex items-center gap-2"><UserPlus size={17} className="text-violet-300" /><h2 className="text-sm font-semibold text-white">Add an existing Organization member</h2></div>
          <p className="mt-1 text-xs leading-5 text-white/35">Only active profiles already belonging to this Organization can be assigned to this Team. Team access does not grant Organization Admin or Owner authority.</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Search an Organization member..." className="w-full rounded-xl border border-white/10 bg-black/15 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-violet-300/45" /></div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#10102d] px-3 py-2 text-xs text-white/45">Team access<select aria-label="Team access role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as "admin" | "member")} className="rounded-lg bg-transparent px-1 py-1 text-sm text-white outline-none"><option value="member">Team member</option><option value="admin">Team admin</option></select></label>
            <button onClick={() => void search()} disabled={busy === "search"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50">{busy === "search" ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}Search</button>
          </div>
          {candidates.length > 0 && <div className="mt-4 grid gap-2">{candidates.map((candidate) => <div key={candidate.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/10 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white/80">{candidate.name || candidate.email}</p><p className="truncate text-xs text-white/35">{candidate.email}</p></div><button onClick={() => void add(candidate.id)} disabled={busy === candidate.id} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/15 hover:text-white disabled:opacity-50">{busy === candidate.id ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}Add to Team</button></div>)}</div>}
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/9 bg-white/[0.035]">
          <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-semibold text-white">Active Team members</h2><p className="mt-1 text-xs text-white/35">{members.length} member{members.length === 1 ? "" : "s"} assigned to this Team</p></div><UsersRound size={18} className="text-violet-300/70" /></div>
          {members.length === 0 ? <p className="px-5 py-12 text-center text-sm text-white/35">No active members are assigned to this Team.</p> : <div className="divide-y divide-white/8">{members.map((member) => <div key={member.id} className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"><UserRound size={17} /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-white/80">{displayName(member)}</p><p className="truncate text-xs text-white/35">{member.profile.email}</p></div></div><div className="flex flex-wrap items-center gap-2 lg:justify-end"><div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-white/30">Organization role</p><p className={`mt-1 text-[10px] font-semibold tracking-wide ${organizationRoleClasses(organizationRole(member))}`}>{organizationRole(member)}</p></div>                    <div className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.06] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-white/30">
                        Team access <span className="sr-only">Space access</span>
                      </p>
                      <p className="mt-1 text-[10px] font-semibold tracking-wide text-cyan-200">{spaceRole(member)}</p>
                    </div>
                    <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/75">{member.status}</span>
                    <button
                      onClick={() => void changeRole(member)}
                      disabled={busy === member.profile_id}
                      title={member.role === "admin" ? "Make Team member" : "Make Space admin"}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white disabled:opacity-50"
                    >
                      {busy === member.profile_id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                      {member.role === "admin" ? "Make Team member" : <>Make Team admin<span className="sr-only">Make Space admin</span></>}
                    </button><button onClick={() => void remove(member)} disabled={busy === member.profile_id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/10 px-2.5 py-1.5 text-xs text-red-200/65 transition hover:bg-red-400/10 hover:text-red-100 disabled:opacity-50"><UserX size={13} />Remove from Team</button></div></div>)}</div>}
        </section>
      </div>
    </div>
  );
}
