"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Ban, CheckCircle, Clock3, Filter, Mail, RefreshCw, Search, Shield, UserCheck, UserPlus, UserX } from "lucide-react";
import type { TeamMember, UserRole } from "@/src/types/auth";
import { TrackUpContent, TrackUpPageHeader, TrackUpPageShell } from "@/src/components/ui/trackup";

interface TeamMemberManagerProps { currentUserId: string }

function errorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    forbidden: "Only active owner/admin accounts can manage team members.",
    self_modification: "You cannot change your own account.",
    target_is_owner: "The owner account is protected.",
    target_not_found: "That team member no longer exists.",
    database_error: "The database rejected the change. Try again.",
    invalid_email: "Enter a valid email address.",
    invalid_name: "The name must be 255 characters or fewer.",
    invalid_role: "Choose either admin or viewer.",
    owner_email_protected: "The configured owner email is reserved for owner provisioning.",
    user_exists: "That ClickUp email is already connected to TrackUp.",
    delivery_not_configured: "Transactional email is not configured in this environment. No invitation was reported as sent.",
    delivery_failed: "The email provider rejected the invitation. No sent state was recorded.",
    already_accepted: "This invitation was already accepted.",
    revoked: "This invitation was revoked.",
    expired: "This invitation expired. Send a fresh invitation instead.",
    not_found: "That invitation no longer exists.",
  };
  return typeof error === "string" && messages[error] ? messages[error] : "The team operation failed. Try again.";
}

function roleStyle(role: UserRole): string {
  if (role === "owner") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  if (role === "admin") return "border-violet-400/20 bg-violet-500/10 text-violet-200";
  return "border-white/10 bg-white/5 text-white/50";
}

function invitationStyle(status: TeamMember["invitation_status"]): string {
  if (status === "accepted") return "bg-emerald-500/10 text-emerald-200";
  if (status === "pending") return "bg-blue-500/10 text-blue-200";
  if (status === "expired") return "bg-amber-500/10 text-amber-200";
  if (status === "revoked") return "bg-red-500/10 text-red-200";
  return "bg-white/5 text-white/40";
}

function invitationLabel(status: TeamMember["invitation_status"]): string {
  if (status === "not_invited") return "No invitation";
  return status[0].toUpperCase() + status.slice(1);
}

function lastSeenLabel(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never seen";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 1000));
  if (seconds <= 5 * 60) return "Active recently";
  const units: Array<[number, string]> = [[86400, "day"], [3600, "hour"], [60, "minute"]];
  const unit = units.find(([size]) => seconds >= size) ?? [1, "second"];
  const count = Math.floor(seconds / unit[0]);
  return `${count} ${unit[1]}${count === 1 ? "" : "s"} ago`;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function TeamMemberManager({ currentUserId }: TeamMemberManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
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
      if (!data.user || typeof data.user.email !== "string" || data.sent !== true || !data.invitation || typeof data.invitation.expires_at !== "string") { setError("The server did not confirm transactional email dispatch."); return; }
      await loadMembers();
      setEmail(""); setName(""); setRole("viewer"); setNotice(`Invitation sent to ${data.user.email}. It expires ${dateLabel(data.invitation.expires_at)}.`);
    } catch { setError("Network error while sending the invitation."); }
    finally { setInviting(false); }
  }

  async function resendInvitation(member: TeamMember) {
    const invitationId = member.invitation?.id;
    if (!invitationId) return;
    setMutating(member.id); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}/resend`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(errorMessage(data.error)); return; }
      if (!data.sent || !data.invitation) { setError("The server did not confirm transactional email dispatch."); return; }
      setNotice(`Invitation resent to ${member.email}. It expires ${dateLabel(data.invitation.expires_at)}.`);
      await loadMembers();
    } catch { setError("Network error while resending the invitation."); }
    finally { setMutating(null); }
  }

  async function revokeInvitation(member: TeamMember) {
    const invitationId = member.invitation?.id;
    if (!invitationId) return;
    setMutating(member.id); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(errorMessage(data.error)); return; }
      setNotice(`Invitation for ${member.email} was revoked.`);
      await loadMembers();
    } catch { setError("Network error while revoking the invitation."); }
    finally { setMutating(null); }
  }

  async function updateRole(member: TeamMember, nextRole: "admin" | "viewer") {
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

  async function updateStatus(member: TeamMember) {
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

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesQuery = !query || `${member.name ?? ""} ${member.email}`.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? member.is_active : !member.is_active);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [members, roleFilter, search, statusFilter]);
  const counts = { total: members.length, active: members.filter((member) => member.is_active).length, pending: members.filter((member) => member.invitation_status === "pending").length, admins: members.filter((member) => member.role === "admin").length };

  return (
    <TrackUpPageShell>
      <TrackUpContent>
        <TrackUpPageHeader
          eyebrow="Team access"
          title="Team members"
          description="Invite teammates by email, activate their assigned ClickUp role after same-email authentication, and see server-recorded presence. Profiles remain global in the current architecture; workspace memberships are intentionally unchanged."
          action={<button onClick={() => void loadMembers()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh directory</button>}
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:p-5"><p className="text-xs text-white/40">Profiles</p><p className="mt-3 text-2xl font-semibold text-white">{counts.total}</p></div><div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 sm:p-5"><p className="text-xs text-emerald-200/60">Active</p><p className="mt-3 text-2xl font-semibold text-white">{counts.active}</p></div><div className="rounded-2xl border border-blue-400/15 bg-blue-500/5 p-4 sm:p-5"><p className="text-xs text-blue-200/60">Pending invites</p><p className="mt-3 text-2xl font-semibold text-white">{counts.pending}</p></div><div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4 sm:p-5"><p className="text-xs text-violet-200/60">Admins</p><p className="mt-3 text-2xl font-semibold text-white">{counts.admins}</p></div></section>

        <form onSubmit={(event) => void createInvite(event)} className="rounded-3xl border border-violet-300/12 bg-linear-to-br from-violet-500/[0.10] via-white/[0.035] to-blue-500/[0.08] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Mail size={18} /></div><div><h2 className="font-semibold text-white">Send a secure invitation</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-white/45">The invitation is single-use, expires in 7 days, and is reported as sent only after the configured transactional provider confirms the request.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_1fr_150px_auto] md:items-end"><label className="block"><span className="mb-1.5 block text-xs text-white/50">Email address</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50" /></label><label className="block"><span className="mb-1.5 block text-xs text-white/50">Name <span className="text-white/25">(optional)</span></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Teammate name" className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50" /></label><label className="block"><span className="mb-1.5 block text-xs text-white/50">Role</span><select value={role} onChange={(event) => setRole(event.target.value as "admin" | "viewer")} className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/50"><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><button type="submit" disabled={inviting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus size={15} />{inviting ? "Sending..." : "Send invitation"}</button></div></form>

        {(error || notice) && <div role="status" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>{error ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}<span>{error ?? notice}</span></div>}

        <section className="rounded-3xl border border-white/9 bg-white/[0.03] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><label className="relative block min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><span className="sr-only">Search team members</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="w-full rounded-xl border border-white/10 bg-black/15 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50" /></label><div className="flex flex-col gap-2 sm:flex-row"><label className="flex items-center gap-2 text-xs text-white/40"><Filter size={14} /><span className="sr-only">Filter role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/70 outline-none"><option value="all">All roles</option><option value="owner">Owners</option><option value="admin">Admins</option><option value="viewer">Viewers</option></select></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/70 outline-none"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div></section>

        {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl border border-white/6 bg-white/[0.03]" />)}</div> : error && members.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><AlertCircle size={28} className="mx-auto mb-3 text-red-300/70" /><p className="text-sm text-white/50">Team directory could not be loaded.</p><button onClick={() => void loadMembers()} className="mt-4 text-sm text-violet-300 hover:text-violet-200">Try again</button></div> : filteredMembers.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><Shield size={28} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/50">No members match these filters.</p></div> : <div className="overflow-hidden rounded-3xl border border-white/9 bg-white/[0.03]"><div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_170px_minmax(0,1.2fr)] gap-4 border-b border-white/8 px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-white/30 md:grid"><span>Member</span><span>Role</span><span>Account</span><span>Invitation</span><span>Activity & actions</span></div><div className="divide-y divide-white/7">{filteredMembers.map((member) => { const protectedAccount = member.id === currentUserId || member.role === "owner"; const busy = mutating === member.id; const pending = member.invitation_status === "pending" || member.invitation_status === "expired"; return <div key={member.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_110px_110px_170px_minmax(0,1.2fr)] md:items-center md:gap-4 md:px-5"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-300"><Shield size={16} /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{member.name || member.email}</p><p className="truncate text-xs text-white/35">{member.email}</p></div></div><span className={`w-fit rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${roleStyle(member.role)}`}>{member.role}</span><span className={`w-fit rounded-full px-2 py-1 text-[10px] ${member.is_active ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>{member.is_active ? "Active" : "Inactive"}</span><div className="space-y-1"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${invitationStyle(member.invitation_status)}`}><Clock3 size={11} />{invitationLabel(member.invitation_status)}</span>{member.invitation && <p className="text-[10px] text-white/30">{member.invitation.last_sent_at ? `Sent ${dateLabel(member.invitation.last_sent_at)}` : `Expires ${dateLabel(member.invitation.expires_at)}`}</p>}</div><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="mr-1 text-xs text-white/45">{lastSeenLabel(member.last_seen_at)}</span>{!protectedAccount && <><button onClick={() => void updateRole(member, member.role === "admin" ? "viewer" : "admin")} disabled={busy} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/60 transition hover:border-violet-400/25 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-35">{member.role === "admin" ? "Make viewer" : "Promote admin"}</button><button onClick={() => void updateStatus(member)} disabled={busy} title={member.is_active ? "Deactivate account" : "Activate account"} className="rounded-lg border border-white/10 p-1.5 text-white/45 transition hover:border-red-400/25 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35">{member.is_active ? <UserX size={14} /> : <UserCheck size={14} />}</button></>}{pending && member.invitation && <><button onClick={() => void resendInvitation(member)} disabled={busy} title="Resend invitation" className="rounded-lg border border-blue-400/20 px-2.5 py-1.5 text-xs text-blue-200 transition hover:bg-blue-500/10 disabled:opacity-35"><RefreshCw size={13} className="mr-1 inline" />Resend</button><button onClick={() => void revokeInvitation(member)} disabled={busy} title="Revoke invitation" className="rounded-lg border border-red-400/20 px-2.5 py-1.5 text-xs text-red-200 transition hover:bg-red-500/10 disabled:opacity-35"><Ban size={13} className="mr-1 inline" />Revoke</button></>}</div></div>; })}</div></div>}
      </TrackUpContent>
    </TrackUpPageShell>
  );
}
