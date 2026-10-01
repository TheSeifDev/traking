"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle,
  Filter,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import type { TeamMember, UserRole } from "@/src/types/auth";
import { TrackUpContent, TrackUpPageHeader, TrackUpPageShell } from "@/src/components/ui/trackup";

interface TeamMemberManagerProps {
  currentUserId: string;
}

function errorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    forbidden: "Only active platform owners can provision or manage team accounts.",
    self_modification: "You cannot change or deactivate your own account.",
    target_is_owner: "The platform owner account is protected.",
    target_not_found: "That team member no longer exists.",
    database_error: "Database rejected the request. Please try again.",
    invalid_email: "Enter a valid email address.",
    invalid_username: "Username must be 3-30 characters (alphanumeric and underscore).",
    invalid_name: "Name must be 255 characters or fewer.",
    invalid_role: "Choose either 'admin' or 'viewer'.",
    user_exists: "A user with that username or email already exists in TrackUp.",
    password_policy_violation: "Password must be at least 10 characters with uppercase, lowercase, number, and symbol.",
    delivery_not_configured: "Transactional email is not configured in this environment. No invitation was reported as sent.",
    delivery_failed: "The transactional provider rejected the invitation.",
    already_accepted: "This invitation was already accepted.",
    revoked: "This invitation was revoked.",
    expired: "This invitation expired.",
    not_found: "That invitation was not found.",
  };
  return typeof error === "string" && messages[error] ? messages[error] : "The operation failed. Try again.";
}

function roleStyle(role: UserRole): string {
  if (role === "owner") return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  if (role === "admin") return "border-violet-400/20 bg-violet-500/10 text-violet-200";
  return "border-white/10 bg-white/5 text-white/50";
}


function lastSeenLabel(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "Never active";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 1000));
  if (seconds <= 5 * 60) return "Active recently";
  const units: Array<[number, string]> = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  const unit = units.find(([size]) => seconds >= size) ?? [1, "second"];
  const count = Math.floor(seconds / unit[0]);
  return `${count} ${unit[1]}${count === 1 ? "" : "s"} ago`;
}

export default function TeamMemberManager({ currentUserId }: TeamMemberManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);

  // Tab mode
  const [mode, setMode] = useState<"provision" | "invite">("provision");

  // New user credentials form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [creating, setCreating] = useState(false);

  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/users", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Fallback to /api/admin/users
        const fallback = await fetch("/api/admin/users", { cache: "no-store" });
        const fbData = await fallback.json().catch(() => ({}));
        if (fallback.ok && Array.isArray(fbData.users)) {
          setMembers(fbData.users);
          return;
        }
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
    const timer = window.setTimeout(() => {
      void loadMembers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMembers]);

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
          username: username.trim(),
          email: email.trim(),
          password,
          role,
          name: name.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || errorMessage(data.error));
        return;
      }

      await loadMembers();
      setUsername("");
      setEmail("");
      setPassword("");
      setName("");
      setRole("viewer");
      setNotice(`User ${data.user.username || data.user.email} was successfully provisioned as ${data.user.role}.`);
    } catch {
      setError("Network error while provisioning user.");
    } finally {
      setCreating(false);
    }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorMessage(data.error));
        return;
      }
      setNotice(`Invitation sent to ${inviteEmail}. Transactional provider confirmed dispatch.`);
      setInviteEmail("");
      await loadMembers();
    } catch {
      setError("Network error while sending the invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function resendInvitation(member: TeamMember) {
    const invitationId = member.invitation?.id;
    if (!invitationId) return;
    setMutating(member.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}/resend`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorMessage(data.error));
        return;
      }
      setNotice(`Invitation resent to ${member.email}.`);
      await loadMembers();
    } catch {
      setError("Network error while resending the invitation.");
    } finally {
      setMutating(null);
    }
  }

  async function revokeInvitation(member: TeamMember) {
    const invitationId = member.invitation?.id;
    if (!invitationId) return;
    setMutating(member.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(errorMessage(data.error));
        return;
      }
      setNotice(`Invitation for ${member.email} was revoked.`);
      await loadMembers();
    } catch {
      setError("Network error while revoking the invitation.");
    } finally {
      setMutating(null);
    }
  }

  async function handleResetPassword(member: TeamMember) {
    const newPassword = prompt(`Enter new password for ${member.username || member.email} (min 10 characters):`);
    if (!newPassword) return;

    setMutating(member.id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/owner/users/${member.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || errorMessage(data.error));
        return;
      }

      setNotice(`Password successfully reset for ${member.username || member.email}. All existing sessions were revoked.`);
    } catch {
      setError("Network error while resetting password.");
    } finally {
      setMutating(null);
    }
  }

  async function updateRole(member: TeamMember, nextRole: "admin" | "viewer") {
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
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, role: nextRole } : item))
      );
      setNotice(`${member.username || member.email} is now ${nextRole}. Active sessions revoked.`);
    } catch {
      setError("Network error while changing the team role.");
    } finally {
      setMutating(null);
    }
  }

  async function updateStatus(member: TeamMember) {
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
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, is_active: nextStatus } : item))
      );
      setNotice(
        `${member.username || member.email} is now ${nextStatus ? "active" : "inactive"}.${!nextStatus ? " Active sessions were revoked." : ""}`
      );
    } catch {
      setError("Network error while changing account status.");
    } finally {
      setMutating(null);
    }
  }

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesQuery =
        !query ||
        `${member.name ?? ""} ${member.username ?? ""} ${member.email}`.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? member.is_active : !member.is_active);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [members, roleFilter, search, statusFilter]);

  const counts = {
    total: members.length,
    active: members.filter((member) => member.is_active).length,
    admins: members.filter((member) => member.role === "admin").length,
    viewers: members.filter((member) => member.role === "viewer").length,
  };

  return (
    <TrackUpPageShell>
      <TrackUpContent>
        <TrackUpPageHeader
          eyebrow="Team Management"
          title="Team Members & Credentials"
          description="Provision new TrackUp users with sovereign credentials or send transactional invitations. Manage role assignments, reset credentials, and monitor active account statuses."
          action={
            <button
              onClick={() => void loadMembers()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh Directory
            </button>
          }
        />

        {/* Directory Statistics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:p-5">
            <p className="text-xs text-white/40">Total Accounts</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 sm:p-5">
            <p className="text-xs text-emerald-200/60">Active Accounts</p>
            <p className="mt-2 text-2xl font-semibold text-white">{counts.active}</p>
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

        {/* Mode Selector */}
        <div className="flex gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setMode("provision")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
              mode === "provision"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <UserPlus size={14} />
            Direct User Provisioning
          </button>
          <button
            type="button"
            onClick={() => setMode("invite")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
              mode === "invite"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Mail size={14} />
            Send a secure invitation
          </button>
        </div>

        {/* Provisioning / Invitation Forms */}
        {mode === "provision" ? (
          <form
            onSubmit={(event) => void handleCreateUser(event)}
            className="rounded-3xl border border-violet-300/12 bg-linear-to-br from-violet-500/[0.10] via-white/[0.035] to-blue-500/[0.08] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                <UserPlus size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-white">Provision New User</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-white/45">
                  Create a native TrackUp account with sovereign credentials. Passwords must be at least 10 characters with uppercase, lowercase, number, and symbol.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">Username</span>
                <input
                  required
                  type="text"
                  pattern="^[a-zA-Z0-9_]{3,30}$"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alex_dev"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">Initial Password</span>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 10 characters"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="admin">Admin (Manage)</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={creating}
                className="inline-flex h-9.5 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus size={15} />
                {creating ? "Provisioning..." : "Create User"}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(event) => void createInvite(event)}
            className="rounded-3xl border border-violet-300/12 bg-linear-to-br from-violet-500/[0.10] via-white/[0.035] to-blue-500/[0.08] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                <Mail size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-white">Send a secure invitation</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-white/45">
                  Dispatched securely via the configured transactional provider. Recipient will receive an invitation token to activate their account.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs text-white/50">Recipient Email</span>
                <input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "viewer")}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="admin">Admin (Manage)</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={inviting}
                className="inline-flex h-9.5 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail size={15} />
                {inviting ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </form>
        )}

        {/* Feedback Alerts */}
        {(error || notice) && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-400/20 bg-red-500/10 text-red-100"
                : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {error ? (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{error ?? notice}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <section className="rounded-3xl border border-white/9 bg-white/[0.03] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block min-w-0 flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <span className="sr-only">Search team members</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username, email, or name"
                className="w-full rounded-xl border border-white/10 bg-black/15 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex items-center gap-2 text-xs text-white/40">
                <Filter size={14} />
                <span className="sr-only">Filter role</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as "all" | UserRole)}
                  className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/70 outline-none"
                >
                  <option value="all">All roles</option>
                  <option value="owner">Owners</option>
                  <option value="admin">Admins</option>
                  <option value="viewer">Viewers</option>
                </select>
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs text-white/70 outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </section>

        {/* Members Directory Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-xl border border-white/6 bg-white/[0.03]" />
            ))}
          </div>
        ) : error && members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
            <AlertCircle size={28} className="mx-auto mb-3 text-red-300/70" />
            <p className="text-sm text-white/50">Team directory could not be loaded.</p>
            <button onClick={() => void loadMembers()} className="mt-4 text-sm text-violet-300 hover:text-violet-200">
              Try again
            </button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
            <Shield size={28} className="mx-auto mb-3 text-white/20" />
            <p className="text-sm text-white/50">No accounts match these filters.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/9 bg-white/[0.03]">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_100px_100px_minmax(0,1.2fr)] gap-4 border-b border-white/8 px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-white/30 md:grid">
              <span>Account Identity</span>
              <span>Role</span>
              <span>Status</span>
              <span>Activity & Operations</span>
            </div>
            <div className="divide-y divide-white/7">
              {filteredMembers.map((member) => {
                const protectedAccount = member.id === currentUserId || member.role === "owner";
                const busy = mutating === member.id;
                const hasPendingInvite = member.invitation_status === "pending" || Boolean(member.invitation);

                return (
                  <div
                    key={member.id}
                    className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_100px_100px_minmax(0,1.2fr)] md:items-center md:gap-4 md:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-300">
                        <Shield size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {member.username ? `@${member.username}` : member.name || member.email}
                        </p>
                        <p className="truncate text-xs text-white/35">{member.email}</p>
                      </div>
                    </div>

                    <span className={`w-fit rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wide font-medium ${roleStyle(member.role)}`}>
                      {member.role}
                    </span>

                    <span
                      className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                        member.is_active ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"
                      }`}
                    >
                      {member.is_active ? "Active" : "Inactive"}
                    </span>

                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="mr-2 text-xs text-white/45">
                        {lastSeenLabel(member.last_seen_at)}
                      </span>

                      {!protectedAccount && (
                        <>
                          <button
                            onClick={() =>
                              void updateRole(member, member.role === "admin" ? "viewer" : "admin")
                            }
                            disabled={busy}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 transition hover:border-violet-400/25 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {member.role === "admin" ? "Make Viewer" : "Promote Admin"}
                          </button>

                          <button
                            onClick={() => void handleResetPassword(member)}
                            disabled={busy}
                            title="Reset password"
                            className="rounded-lg border border-white/10 p-1.5 text-white/45 transition hover:border-violet-400/25 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <KeyRound size={14} />
                          </button>

                          <button
                            onClick={() => void updateStatus(member)}
                            disabled={busy}
                            title={member.is_active ? "Deactivate account" : "Activate account"}
                            className="rounded-lg border border-white/10 p-1.5 text-white/45 transition hover:border-red-400/25 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {member.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        </>
                      )}

                      {hasPendingInvite && (
                        <>
                          <button
                            onClick={() => void resendInvitation(member)}
                            disabled={busy}
                            title="Resend invitation"
                            className="rounded-lg border border-blue-400/20 px-2.5 py-1 text-xs text-blue-200 transition hover:bg-blue-500/10 disabled:opacity-35"
                          >
                            <RefreshCw size={12} className="mr-1 inline" />
                            Resend
                          </button>
                          <button
                            onClick={() => void revokeInvitation(member)}
                            disabled={busy}
                            title="Revoke invitation"
                            className="rounded-lg border border-red-400/20 px-2.5 py-1 text-xs text-red-200 transition hover:bg-red-500/10 disabled:opacity-35"
                          >
                            <Ban size={12} className="mr-1 inline" />
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </TrackUpContent>
    </TrackUpPageShell>
  );
}
