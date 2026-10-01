"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import type { TeamMember, UserRole } from "@/src/types/auth";
import { TrackUpContent, TrackUpPageHeader, TrackUpPageShell } from "@/src/components/ui/trackup";
import { confirmAction } from "@/src/components/feedback/TrackUpFeedbackProvider";

interface OwnerAdminsManagerProps {
  currentUserId: string;
}

function roleBadge(role: UserRole) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
        <ShieldCheck size={13} />
        Platform Owner
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
      <Shield size={13} />
      Administrator
    </span>
  );
}

export default function OwnerAdminsManager({ currentUserId }: OwnerAdminsManagerProps) {
  const [admins, setAdmins] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/admins", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load platform administrators.");
        return;
      }
      // Strict client-side assertion in addition to server-side query filter:
      const adminList = (Array.isArray(data.admins) ? data.admins : []).filter(
        (u: TeamMember) => u.role === "owner" || u.role === "admin"
      );
      setAdmins(adminList);
    } catch {
      setError("Network error while loading administrators.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdmins();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAdmins]);

  async function handleDemoteToViewer(targetUserId: string, username: string) {
    const confirmed = await confirmAction({
      title: `Demote administrator '${username}' to Viewer?`,
      description: "This removes administrator authority while preserving the user account.",
      confirmLabel: "Demote Administrator",
      tone: "danger",
    });
    if (!confirmed) return;
    setMutating(targetUserId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/owner/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: targetUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || data.error || "Failed to demote administrator.");
        return;
      }
      setNotice(`User '${username}' was demoted to Viewer.`);
      await loadAdmins();
    } catch {
      setError("Network error while updating role.");
    } finally {
      setMutating(null);
    }
  }

  async function handleToggleActive(targetUserId: string, currentActive: boolean, username: string) {
    const action = currentActive ? "deactivate" : "reactivate";
    const confirmed = await confirmAction({
      title: `${currentActive ? "Deactivate" : "Reactivate"} administrator '${username}'?`,
      description: currentActive ? "The administrator will lose access until an owner reactivates the account." : "The administrator will regain access using their existing role and permissions.",
      confirmLabel: currentActive ? "Deactivate Administrator" : "Reactivate Administrator",
      tone: currentActive ? "danger" : "default",
    });
    if (!confirmed) return;
    setMutating(targetUserId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/owner/users/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || data.error || `Failed to ${action} user.`);
        return;
      }
      setNotice(`Administrator '${username}' was ${currentActive ? "deactivated" : "reactivated"}.`);
      await loadAdmins();
    } catch {
      setError("Network error while updating status.");
    } finally {
      setMutating(null);
    }
  }

  const filteredAdmins = admins.filter((a) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (a.username && a.username.toLowerCase().includes(term)) ||
      a.email.toLowerCase().includes(term) ||
      (a.name && a.name.toLowerCase().includes(term))
    );
  });

  const counts = {
    total: admins.length,
    active: admins.filter((a) => a.is_active).length,
    owner: admins.filter((a) => a.role === "owner").length,
    admin: admins.filter((a) => a.role === "admin").length,
  };

  return (
    <TrackUpPageShell>
      <TrackUpContent>
        <TrackUpPageHeader
          eyebrow="Platform Governance"
          title="Administrators"
          description="Manage platform administrators (Platform Owner and Admins). Standard Viewer accounts are managed separately in User Accounts."
          action={
            <button
              onClick={() => void loadAdmins()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh Administrators
            </button>
          }
        />

        {/* Status Notices */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle size={16} className="shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Statistics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:p-5">
            <p className="text-xs text-white/40">Total Administrators</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 sm:p-5">
            <p className="text-xs text-emerald-200/60">Active</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.active}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4 sm:p-5">
            <p className="text-xs text-amber-200/60">Platform Owner</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.owner}</p>
          </div>
          <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4 sm:p-5">
            <p className="text-xs text-violet-200/60">Admins</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.admin}</p>
          </div>
        </section>

        {/* Directory Card */}
        <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/8">
            <div>
              <h2 className="text-base font-semibold text-white">Administrator Directory</h2>
              <p className="text-xs text-white/40 mt-0.5">
                Only accounts with OWNER or ADMIN platform roles are displayed.
              </p>
            </div>
            <div className="relative min-w-64">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search administrators..."
                className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <div className="mt-4 divide-y divide-white/6 overflow-x-auto">
            {filteredAdmins.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/30">
                {search ? "No administrators match your search." : "No administrators found."}
              </div>
            ) : (
              filteredAdmins.map((admin) => {
                const isSelf = admin.id === currentUserId;
                const isTargetOwner = admin.role === "owner";
                const isBusy = mutating === admin.id;

                return (
                  <div
                    key={admin.id}
                    className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
                        {isTargetOwner ? <ShieldAlert size={18} className="text-amber-300" /> : <Shield size={18} className="text-violet-300" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{admin.username}</p>
                          {isSelf && (
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                              You
                            </span>
                          )}
                          {!admin.is_active && (
                            <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-white/40">{admin.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {roleBadge(admin.role)}

                      {!isTargetOwner && !isSelf && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDemoteToViewer(admin.id, admin.username || admin.email)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 transition hover:border-amber-400/30 hover:bg-amber-500/10 hover:text-amber-200 disabled:opacity-40"
                            title="Demote to standard Viewer"
                          >
                            <UserX size={13} />
                            Demote to Viewer
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleActive(admin.id, admin.is_active, admin.username || admin.email)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition disabled:opacity-40 ${
                              admin.is_active
                                ? "border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/10"
                                : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10"
                            }`}
                          >
                            {admin.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                            {admin.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </TrackUpContent>
    </TrackUpPageShell>
  );
}
