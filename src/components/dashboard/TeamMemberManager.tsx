"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle, Filter, RefreshCw, Search, Shield, UserCheck, UserPlus, UserX } from "lucide-react";
import type { Profile, UserRole } from "@/src/types/auth";

interface TeamMemberManagerProps { currentUserId: string }

function errorMessage(error: unknown): string {
  const messages: Record<string, string> = { forbidden: "Only the owner can invite users or change team roles/status.", self_modification: "You cannot change your own account.", target_is_owner: "The owner account is protected.", target_not_found: "That team member no longer exists.", database_error: "The database rejected the change. Try again.", invalid_email: "Enter a valid email address.", invalid_name: "The name must be 255 characters or fewer.", invalid_role: "Choose either admin or viewer.", owner_email_protected: "The configured owner email is reserved for owner provisioning.", user_exists: "That ClickUp email is already connected to TrackUp." };
  return typeof error === "string" && messages[error] ? messages[error] : "The team operation failed. Try again.";
}

function roleStyle(role: UserRole): string {
  if (role === "owner") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  if (role === "admin") return "border-violet-400/20 bg-violet-500/10 text-violet-200";
  return "border-white/10 bg-white/5 text-white/50";
}

export default function TeamMemberManager({ currentUserId }: TeamMemberManagerProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const loadMembers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(errorMessage(data.error)); return; }
      setMembers(Array.isArray(data.users) ? data.users : []);
    } catch { setError("Network error while loading team members."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadMembers(); }, 0); return () => window.clearTimeout(timer); }, [loadMembers]);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setInviting(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name: name || undefined, role }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(errorMessage(data.error)); return; }
      if (!data.user) { setError("The server did not return the created profile."); return; }
      setMembers((current) => { const withoutDuplicate = current.filter((member) => member.id !== data.user.id); return [...withoutDuplicate, data.user as Profile].sort((a, b) => a.created_at.localeCompare(b.created_at)); });
      setEmail(""); setName(""); setRole("viewer"); setNotice(`${data.user.email} is pre-provisioned as ${data.user.role}. They must sign in through ClickUp using this same email.`);
    } catch { setError("Network error while creating the profile."); }
    finally { setInviting(false); }
  }

  async function updateRole(member: Profile, nextRole: "admin" | "viewer") {
    if (member.id === currentUserId || member.role === "owner" || member.role === nextRole) return;
    setMutating(member.id); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/owner/admins", { method: nextRole === "admin" ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: member.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(errorMessage(data.error)); return; }
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, role: nextRole } : item)); setNotice(`${member.email} is now ${nextRole}.`);
    } catch { setError("Network error while changing the team role."); }
    finally { setMutating(null); }
  }

  async function updateStatus(member: Profile) {
    if (member.id === currentUserId || member.role === "owner") return;
    setMutating(member.id); setError(null); setNotice(null); const nextStatus = !member.is_active;
    try {
      const response = await fetch(`/api/owner/users/${member.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: nextStatus }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(errorMessage(data.error)); return; }
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, is_active: nextStatus } : item)); setNotice(`${member.email} is ${nextStatus ? "active" : "inactive"}.`);
    } catch { setError("Network error while changing account status."); }
    finally { setMutating(null); }
  }

  const filteredMembers = useMemo(() => { const query = search.trim().toLowerCase(); return members.filter((member) => { const matchesQuery = !query || `${member.name ?? ""} ${member.email}`.toLowerCase().includes(query); const matchesRole = roleFilter === "all" || member.role === roleFilter; const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? member.is_active : !member.is_active); return matchesQuery && matchesRole && matchesStatus; }); }, [members, roleFilter, search, statusFilter]);
  const counts = { total: members.length, active: members.filter((member) => member.is_active).length, admins: members.filter((member) => member.role === "admin").length };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.09),transparent_35%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7 lg:space-y-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/70">Owner controls</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Team members</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Manage the global profiles currently supported by TrackUp. Permissions are enforced on the server; this directory is not a substitute for workspace memberships.</p></div><button onClick={() => void loadMembers()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/65 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh directory</button></header>

        <section className="grid grid-cols-3 gap-3"><div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:p-5"><p className="text-xs text-white/40">Profiles</p><p className="mt-3 text-2xl font-semibold text-white">{counts.total}</p></div><div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 sm:p-5"><p className="text-xs text-emerald-200/60">Active</p><p className="mt-3 text-2xl font-semibold text-white">{counts.active}</p></div><div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4 sm:p-5"><p className="text-xs text-violet-200/60">Admins</p><p className="mt-3 text-2xl font-semibold text-white">{counts.admins}</p></div></section>

        <form onSubmit={(event) => void createInvite(event)} className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-5 shadow-xl shadow-black/10 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><UserPlus size={18} /></div><div><h2 className="font-semibold text-white">Pre-provision a ClickUp teammate</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-white/45">This uses the real profile API. TrackUp does not send an email in the current architecture; the teammate must sign in through ClickUp using the same email.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_1fr_150px_auto] md:items-end"><label className="block"><span className="mb-1.5 block text-xs text-white/50">ClickUp email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50" /></label><label className="block"><span className="mb-1.5 block text-xs text-white/50">Name <span className="text-white/25">(optional)</span></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Teammate name" className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50" /></label><label className="block"><span className="mb-1.5 block text-xs text-white/50">Role</span><select value={role} onChange={(event) => setRole(event.target.value as "admin" | "viewer")} className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/50"><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><button type="submit" disabled={inviting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus size={15} />{inviting ? "Creating..." : "Create profile"}</button></div></form>

        {(error || notice) && <div role="status" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>{error ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}<span>{error ?? notice}</span></div>}

        <section className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 shadow-xl shadow-black/10 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><label className="relative block min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><span className="sr-only">Search team members</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="w-full rounded-xl border border-white/10 bg-black/15 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50" /></label><div className="flex flex-col gap-2 sm:flex-row"><label className="flex items-center gap-2 text-xs text-white/40"><Filter size={14} /><span className="sr-only">Filter role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/70 outline-none"><option value="all">All roles</option><option value="owner">Owners</option><option value="admin">Admins</option><option value="viewer">Viewers</option></select></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/70 outline-none"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div></section>

        {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl border border-white/6 bg-white/[0.03]" />)}</div> : error && members.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><AlertCircle size={28} className="mx-auto mb-3 text-red-300/70" /><p className="text-sm text-white/50">Team directory could not be loaded.</p><button onClick={() => void loadMembers()} className="mt-4 text-sm text-violet-300 hover:text-violet-200">Try again</button></div> : filteredMembers.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><Shield size={28} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/50">No members match these filters.</p></div> : <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"><div className="hidden grid-cols-[minmax(0,1fr)_110px_100px_250px] gap-4 border-b border-white/8 px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-white/30 md:grid"><span>Member</span><span>Role</span><span>Status</span><span>Owner actions</span></div><div className="divide-y divide-white/7">{filteredMembers.map((member) => { const protectedAccount = member.id === currentUserId || member.role === "owner"; const busy = mutating === member.id; return <div key={member.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_110px_100px_250px] md:items-center md:gap-4 md:px-5"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-300"><Shield size={16} /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{member.name || member.email}</p><p className="truncate text-xs text-white/35">{member.email}</p></div></div><span className={`w-fit rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${roleStyle(member.role)}`}>{member.role}</span><span className={`w-fit rounded-full px-2 py-1 text-[10px] ${member.is_active ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>{member.is_active ? "Active" : "Inactive"}</span><div className="flex flex-wrap items-center gap-2"><button onClick={() => void updateRole(member, member.role === "admin" ? "viewer" : "admin")} disabled={protectedAccount || busy} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/60 transition hover:border-violet-400/25 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-35">{member.role === "admin" ? "Make viewer" : "Promote admin"}</button><button onClick={() => void updateStatus(member)} disabled={protectedAccount || busy} title={member.is_active ? "Deactivate account" : "Activate account"} className="rounded-lg border border-white/10 p-1.5 text-white/45 transition hover:border-red-400/25 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35">{member.is_active ? <UserX size={14} /> : <UserCheck size={14} />}</button></div></div>; })}</div></div>}
      </div>
    </div>
  );
}
