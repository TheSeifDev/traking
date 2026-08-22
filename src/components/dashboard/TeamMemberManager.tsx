"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle, RefreshCw, Shield, UserCheck, UserX } from "lucide-react";
import type { Profile, UserRole } from "@/src/types/auth";

interface TeamMemberManagerProps {
  currentUserId: string;
}

function errorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    forbidden: "Only the owner can change team roles or status.",
    self_modification: "You cannot change your own account.",
    target_is_owner: "The owner account is protected.",
    target_not_found: "That team member no longer exists.",
    database_error: "The database rejected the change. Try again.",
    not_implemented: "Invites are not implemented by the current backend.",
  };
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

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorMessage(data.error));
        return;
      }
      setMembers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError("Network error while loading team members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMembers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMembers]);

  async function updateRole(member: Profile, nextRole: "admin" | "viewer") {
    if (member.id === currentUserId || member.role === "owner" || member.role === nextRole) return;
    setMutating(member.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/owner/admins", {
        method: nextRole === "admin" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: member.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorMessage(data.error));
        return;
      }
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, role: nextRole } : item));
      setNotice(`${member.email} is now ${nextRole}.`);
    } catch {
      setError("Network error while changing the team role.");
    } finally {
      setMutating(null);
    }
  }

  async function updateStatus(member: Profile) {
    if (member.id === currentUserId || member.role === "owner") return;
    setMutating(member.id);
    setError(null);
    setNotice(null);
    const nextStatus = !member.is_active;
    try {
      const response = await fetch(`/api/owner/users/${member.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorMessage(data.error));
        return;
      }
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, is_active: nextStatus } : item));
      setNotice(`${member.email} is ${nextStatus ? "active" : "inactive"}.`);
    } catch {
      setError("Network error while changing account status.");
    } finally {
      setMutating(null);
    }
  }

  return (
    <div className="space-y-7 p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Owner controls</p><h1 className="mt-2 text-2xl font-bold text-white">Team members</h1><p className="mt-1 text-sm text-white/45">Manage the global profiles currently supported by TrackUp.</p></div>
        <button onClick={() => void loadMembers()} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
      </header>

      <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4 text-sm text-amber-100/80"><p className="font-medium text-amber-100">Invites are not available yet.</p><p className="mt-1 text-xs leading-5 text-amber-100/55">The current backend has no invite/create-user implementation: <code className="rounded bg-black/20 px-1">POST /api/admin/users</code> returns <code className="rounded bg-black/20 px-1">501 not_implemented</code>. This page only exposes real role and active-status operations.</p></div>

      {(error || notice) && <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>{error ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}<span>{error ?? notice}</span></div>}

      {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl border border-white/6 bg-white/[0.03]" />)}</div> : error && members.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><AlertCircle size={28} className="mx-auto mb-3 text-red-300/70" /><p className="text-sm text-white/50">Team directory could not be loaded.</p><button onClick={() => void loadMembers()} className="mt-4 text-sm text-violet-300 hover:text-violet-200">Try again</button></div> : members.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><UserCheck size={28} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/50">No profiles found.</p></div> : <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"><div className="hidden grid-cols-[1fr_120px_110px_220px] gap-4 border-b border-white/8 px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-white/30 md:grid"><span>Member</span><span>Role</span><span>Status</span><span>Owner actions</span></div><div className="divide-y divide-white/7">{members.map((member) => { const protectedAccount = member.id === currentUserId || member.role === "owner"; const busy = mutating === member.id; return <div key={member.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_120px_110px_220px] md:items-center md:gap-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-300"><Shield size={15} /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{member.name || member.email}</p><p className="truncate text-xs text-white/35">{member.email}</p></div></div><span className={`w-fit rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${roleStyle(member.role)}`}>{member.role}</span><span className={`w-fit rounded-full px-2 py-1 text-[10px] ${member.is_active ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>{member.is_active ? "Active" : "Inactive"}</span><div className="flex flex-wrap items-center gap-2"><button onClick={() => void updateRole(member, member.role === "admin" ? "viewer" : "admin")} disabled={protectedAccount || busy} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/60 transition hover:border-violet-400/25 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-35">{member.role === "admin" ? "Make viewer" : "Promote admin"}</button><button onClick={() => void updateStatus(member)} disabled={protectedAccount || busy} title={member.is_active ? "Deactivate account" : "Activate account"} className="rounded-lg border border-white/10 p-1.5 text-white/45 transition hover:border-red-400/25 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35">{member.is_active ? <UserX size={14} /> : <UserCheck size={14} />}</button></div></div>; })}</div></div>}
    </div>
  );
}
