/**
 * /settings - User settings and workspace info
 */
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspace } from "@/src/lib/clickup/workspace";
import { Settings, User, Building2, Shield } from "lucide-react";

export default async function SettingsPage() {
  const user = await guardAuth();
  const workspace = await getPrimaryWorkspace(user.id);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={20} className="text-violet-400" />
          Settings
        </h1>
        <p className="text-white/40 text-sm mt-1">Your account and workspace configuration</p>
      </div>

      {/* Profile */}
      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <User size={13} />
          Profile
        </h2>
        <div className="rounded-2xl bg-white/4 border border-white/8 divide-y divide-white/8">
          <div className="flex items-center justify-between p-4">
            <span className="text-sm text-white/50">Name</span>
            <span className="text-sm text-white font-medium">{user.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="text-sm text-white/50">Email</span>
            <span className="text-sm text-white font-medium">{user.email}</span>
          </div>
        </div>
      </section>

      {/* Role */}
      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield size={13} />
          Role
        </h2>
        <div className="rounded-2xl bg-white/4 border border-white/8 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Shield size={16} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white capitalize">{user.role}</p>
              <p className="text-xs text-white/40">
                {user.role === "owner" && "Full system access"}
                {user.role === "admin" && "Team and video management"}
                {user.role === "viewer" && "Read-only access"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 size={13} />
          ClickUp Workspace
        </h2>
        <div className="rounded-2xl bg-white/4 border border-white/8 divide-y divide-white/8">
          {workspace ? (
            <>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-white/50">Workspace</span>
                <span className="text-sm text-white font-medium">{workspace.name}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-white/50">Team ID</span>
                <code className="text-xs text-white/60 font-mono">{workspace.clickup_team_id}</code>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-white/50">Connection</span>
                <span className="flex items-center gap-1.5 text-sm text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                  Connected
                </span>
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-white/40 mb-3">No workspace connected.</p>
              <a
                href="/api/auth/clickup"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
              >
                Connect ClickUp
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}