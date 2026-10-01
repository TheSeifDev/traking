"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UsersRound,
  UserX,
  X,
} from "lucide-react";
import type { UserRole } from "@/src/types/auth";
import { TrackUpContent, TrackUpPageHeader, TrackUpPageShell } from "@/src/components/ui/trackup";

export interface EnrichedUserAccount {
  id: string;
  username: string;
  email: string;
  name: string | null;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
  teams?: Array<{ id: string; name: string }>;
}

export interface AvailableTeam {
  id: string;
  name: string;
  slug?: string;
}

interface UserAccountsManagerProps {
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
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
        <Shield size={13} />
        Administrator
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
      Viewer
    </span>
  );
}

export default function UserAccountsManager({ currentUserId }: UserAccountsManagerProps) {
  const [users, setUsers] = useState<EnrichedUserAccount[]>([]);
  const [availableTeams, setAvailableTeams] = useState<AvailableTeam[]>([]);
  const [counts, setCounts] = useState<{
    total_accounts: number;
    organization_members: number;
    active_accounts: number;
    admins: number;
    viewers: number;
    team_counts: Record<string, number>;
  }>({
    total_accounts: 0,
    organization_members: 0,
    active_accounts: 0,
    admins: 0,
    viewers: 0,
    team_counts: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Create User Form State
  const [showCreate, setShowCreate] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "viewer">("viewer");
  const [selectedCreateTeams, setSelectedCreateTeams] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Manage Teams Modal State
  const [teamModalUser, setTeamModalUser] = useState<EnrichedUserAccount | null>(null);
  const [teamModalAssignedIds, setTeamModalAssignedIds] = useState<string[]>([]);
  const [teamModalAvailable, setTeamModalAvailable] = useState<AvailableTeam[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);

  // Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<EnrichedUserAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/users", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Failed to load user accounts.");
        return;
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
      if (data.counts) setCounts(data.counts);
      if (Array.isArray(data.available_teams)) setAvailableTeams(data.available_teams);
    } catch {
      setError("Network error while loading user accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createUsername.trim(),
          email: createEmail.trim(),
          password: createPassword,
          role: createRole,
          name: createName.trim() || undefined,
          team_ids: selectedCreateTeams,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || data.error || "Failed to provision user.");
        return;
      }

      setNotice(`User account '${createUsername.trim()}' was successfully created with sovereign credentials.`);
      setCreateUsername("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      setCreateRole("viewer");
      setSelectedCreateTeams([]);
      setShowCreate(false);
      await loadUsers();
    } catch {
      setError("Network error while creating user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(targetUserId: string, currentActive: boolean, username: string) {
    const action = currentActive ? "deactivate" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${action} user '${username}'?`)) {
      return;
    }
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
      setNotice(`User '${username}' was ${currentActive ? "deactivated" : "reactivated"}.`);
      await loadUsers();
    } catch {
      setError("Network error while updating status.");
    } finally {
      setMutating(null);
    }
  }

  async function openTeamModal(user: EnrichedUserAccount) {
    setTeamModalUser(user);
    setError(null);
    try {
      const response = await fetch(`/api/owner/users/${user.id}/teams`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setTeamModalAssignedIds(data.assigned_team_ids ?? []);
        setTeamModalAvailable(data.available_teams ?? availableTeams);
      } else {
        setTeamModalAssignedIds(user.teams?.map((t) => t.id) ?? []);
        setTeamModalAvailable(availableTeams);
      }
    } catch {
      setTeamModalAssignedIds(user.teams?.map((t) => t.id) ?? []);
      setTeamModalAvailable(availableTeams);
    }
  }

  async function handleSaveTeams() {
    if (!teamModalUser) return;
    setSavingTeams(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/owner/users/${teamModalUser.id}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_ids: teamModalAssignedIds }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || data.error || "Failed to update team memberships.");
        return;
      }

      setNotice(`Team memberships updated for user '${teamModalUser.username}'.`);
      setTeamModalUser(null);
      await loadUsers();
    } catch {
      setError("Network error while updating team memberships.");
    } finally {
      setSavingTeams(false);
    }
  }

  async function handleResetPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resetModalUser) return;
    setResettingPassword(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/owner/users/${resetModalUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || data.error || "Failed to reset password.");
        return;
      }

      setNotice(`Password for user '${resetModalUser.username}' was successfully reset. All active sessions were revoked.`);
      setResetModalUser(null);
      setNewPassword("");
    } catch {
      setError("Network error while resetting password.");
    } finally {
      setResettingPassword(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter === "active" && !u.is_active) return false;
    if (statusFilter === "inactive" && u.is_active) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.name && u.name.toLowerCase().includes(term))
    );
  });

  return (
    <TrackUpPageShell>
      <TrackUpContent>
        <TrackUpPageHeader
          eyebrow="Account Administration"
          title="User Accounts"
          description="Manage all TrackUp platform accounts, provision sovereign credentials, activate/deactivate accounts, reset passwords, and assign Organization and Team memberships."
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(!showCreate)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500"
              >
                <UserPlus size={15} />
                {showCreate ? "Cancel Provisioning" : "Create User Account"}
              </button>
              <button
                onClick={() => void loadUsers()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                Refresh Directory
              </button>
            </div>
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

        {/* Directory Statistics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:p-5">
            <p className="text-xs text-white/40">Total Accounts</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.total_accounts}</p>
          </div>
          <div className="rounded-2xl border border-indigo-400/15 bg-indigo-500/5 p-4 sm:p-5">
            <p className="text-xs text-indigo-200/60">Org Members</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.organization_members}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 sm:p-5">
            <p className="text-xs text-emerald-200/60">Active Accounts</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.active_accounts}</p>
          </div>
          <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4 sm:p-5">
            <p className="text-xs text-violet-200/60">Admins</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.admins}</p>
          </div>
          <div className="rounded-2xl border border-blue-400/15 bg-blue-500/5 p-4 sm:p-5">
            <p className="text-xs text-blue-200/60">Viewers</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.viewers}</p>
          </div>
        </section>

        {/* Team Membership Counts Bar */}
        {Object.keys(counts.team_counts).length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/60">
            <span className="font-medium text-white/80">Team Memberships:</span>
            {Object.entries(counts.team_counts).map(([teamName, count]) => (
              <span
                key={teamName}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-white/75"
              >
                <span className="font-semibold text-violet-300">{teamName}:</span>
                <span>{count} member{count === 1 ? "" : "s"}</span>
              </span>
            ))}
          </div>
        )}

        {/* Direct Provisioning Form */}
        {showCreate && (
          <form
            onSubmit={(event) => void handleCreateUser(event)}
            className="rounded-3xl border border-violet-300/15 bg-linear-to-br from-violet-500/[0.08] via-white/[0.03] to-blue-500/[0.06] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Provision New User Account</h3>
                  <p className="text-xs text-white/40">
                    Assign initial sovereign credentials, platform role, and team memberships.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  placeholder="e.g. ahmed_dev"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="e.g. ahmed@phantoms.com"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Full Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Ahmed Al-Mansoor"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Min 10 chars (upper, lower, num, sym)"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Platform Role *</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as "admin" | "viewer")}
                  className="w-full rounded-xl border border-white/10 bg-[#10102d] px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
                >
                  <option value="viewer">Viewer (Standard Access)</option>
                  <option value="admin">Administrator (Platform Admin)</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-white/60 mb-2">
                  Team Assignments (Can belong to one or more Teams):
                </label>
                <div className="flex flex-wrap gap-3">
                  {availableTeams.map((team) => {
                    const checked = selectedCreateTeams.includes(team.id);
                    return (
                      <label
                        key={team.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                          checked
                            ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCreateTeams([...selectedCreateTeams, team.id]);
                            } else {
                              setSelectedCreateTeams(selectedCreateTeams.filter((id) => id !== team.id));
                            }
                          }}
                          className="rounded border-white/20 text-violet-600 focus:ring-violet-500"
                        />
                        <span>{team.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50"
              >
                {creating ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Provision User
              </button>
            </div>
          </form>
        )}

        {/* Directory Card */}
        <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-white/8">
            <div>
              <h2 className="text-base font-semibold text-white">All Platform Accounts</h2>
              <p className="text-xs text-white/40 mt-0.5">
                Each account belongs to the sovereign organization and one or more operational teams.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search accounts..."
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none focus:border-violet-400"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as "all" | UserRole)}
                className="rounded-xl border border-white/10 bg-[#10102d] px-3 py-2 text-xs text-white outline-none focus:border-violet-400"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                className="rounded-xl border border-white/10 bg-[#10102d] px-3 py-2 text-xs text-white outline-none focus:border-violet-400"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          <div className="mt-4 divide-y divide-white/6 overflow-x-auto">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/30">
                {search ? "No user accounts match your filter criteria." : "No accounts found."}
              </div>
            ) : (
              filteredUsers.map((account) => {
                const isSelf = account.id === currentUserId;
                const isOwnerAccount = account.role === "owner";
                const isBusy = mutating === account.id;

                return (
                  <div
                    key={account.id}
                    className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
                        {isOwnerAccount ? <ShieldAlert size={18} className="text-amber-300" /> : <UsersRound size={18} className="text-violet-300" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{account.username}</p>
                          {account.name && (
                            <span className="truncate text-xs text-white/50">({account.name})</span>
                          )}
                          {isSelf && (
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                              You
                            </span>
                          )}
                          {!account.is_active && (
                            <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-white/40">{account.email}</p>

                        {/* Assigned Teams */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {(account.teams ?? []).length === 0 ? (
                            <span className="text-[11px] text-white/30 italic">No assigned teams</span>
                          ) : (
                            account.teams?.map((team) => (
                              <span
                                key={team.id}
                                className="inline-block rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-violet-200/80"
                              >
                                {team.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {roleBadge(account.role)}

                      {/* Manage Teams Button */}
                      <button
                        type="button"
                        onClick={() => void openTeamModal(account)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 transition hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-white"
                      >
                        <UsersRound size={13} />
                        Teams
                      </button>

                      {/* Reset Password Button */}
                      {!isOwnerAccount && (
                        <button
                          type="button"
                          onClick={() => {
                            setResetModalUser(account);
                            setNewPassword("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 transition hover:border-white/20 hover:text-white"
                        >
                          <KeyRound size={13} />
                          Reset Password
                        </button>
                      )}

                      {/* Activate / Deactivate Toggle */}
                      {!isOwnerAccount && !isSelf && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleActive(account.id, account.is_active, account.username)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition disabled:opacity-40 ${
                            account.is_active
                              ? "border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/10"
                              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10"
                          }`}
                        >
                          {account.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                          {account.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Manage Teams Modal */}
        {teamModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0d2a] p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <UsersRound size={18} className="text-violet-300" />
                  <h3 className="text-base font-semibold text-white">Manage Team Memberships</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamModalUser(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-white">{teamModalUser.username}</p>
                <p className="text-xs text-white/40">{teamModalUser.email}</p>
                <p className="mt-1 text-xs text-violet-300/80">Organization: PHANTOMS | ORG</p>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold text-white/70">Select Operational Teams:</p>
                {teamModalAvailable.map((team) => {
                  const isChecked = teamModalAssignedIds.includes(team.id);
                  return (
                    <label
                      key={team.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition ${
                        isChecked
                          ? "border-violet-500/40 bg-violet-600/15 text-white"
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      <span className="font-medium">{team.name}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTeamModalAssignedIds([...teamModalAssignedIds, team.id]);
                          } else {
                            setTeamModalAssignedIds(teamModalAssignedIds.filter((id) => id !== team.id));
                          }
                        }}
                        className="rounded border-white/20 text-violet-600 focus:ring-violet-500"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTeamModalUser(null)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingTeams}
                  onClick={() => void handleSaveTeams()}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  {savingTeams && <Loader2 size={13} className="animate-spin" />}
                  Save Memberships
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0d2a] p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <KeyRound size={18} className="text-violet-300" />
                  <h3 className="text-base font-semibold text-white">Reset Account Password</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-white">{resetModalUser.username}</p>
                <p className="text-xs text-white/40">{resetModalUser.email}</p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1">New Temporary Password *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 10 characters (upper, lower, num, sym)"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-violet-400"
                  />
                  <p className="mt-1 text-[11px] text-white/40">
                    The user will be required to change this password on next login.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resettingPassword}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {resettingPassword && <Loader2 size={13} className="animate-spin" />}
                    Confirm Password Reset
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </TrackUpContent>
    </TrackUpPageShell>
  );
}
