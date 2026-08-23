import { Building2, CheckCircle2, ExternalLink, KeyRound, Settings, Shield, SlidersHorizontal, User } from "lucide-react";
import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getSpaceForUser, listSpacesForUser } from "@/src/lib/spaces/service";
import { createAdminClient } from "@/utils/supabase/admin";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5 border-b border-white/7 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span className="text-sm text-white/45">{label}</span><span className="min-w-0 break-words text-sm font-medium text-white sm:text-right">{value}</span></div>;
}

type PageProps = { searchParams?: Promise<{ space_id?: string }> };

export default async function SettingsPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const spaces = await listSpacesForUser(user);
  const requestedSpaceId = params?.space_id?.trim() || null;
  if (!requestedSpaceId && spaces.length > 1) redirect("/spaces?error=select_space");
  const selectedSpaceId = requestedSpaceId ?? spaces[0]?.id ?? null;
  let access = null;
  if (selectedSpaceId) {
    try {
      access = await getSpaceForUser(selectedSpaceId, user);
    } catch {
      redirect("/spaces?error=forbidden");
    }
  }
  const workspace = access?.space.clickup_workspace_id
    ? (await createAdminClient().from("workspaces").select("name, clickup_team_id").eq("id", access.space.clickup_workspace_id).maybeSingle()).data
    : null;
  const spaceRole = access?.is_platform_owner ? "Platform owner" : access?.membership?.role === "admin" ? "Space admin" : access?.membership?.role === "member" ? "Space member" : "No Space membership";
  const roleDescription = access?.is_platform_owner ? "Platform-wide Space and team control" : access?.membership?.role === "admin" ? "Space video, link, and member management" : "Personal Space viewing and analytics access";

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_32%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-7 lg:space-y-8">
        <header><p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/70">Space configuration</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight text-white"><Settings size={25} className="text-violet-300" />Settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Review the account, workspace connection, and measurement rules that govern your TrackUp experience.</p></header>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><User size={18} /></div><div><h2 className="font-semibold text-white">Profile</h2><p className="mt-1 text-xs text-white/35">Identity used by TrackUp for this Space authorization.</p></div></div><div className="mt-5"><InfoRow label="Name" value={user.name ?? "Not provided"} /><InfoRow label="Email" value={user.email} /></div></section>

          <section className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><Shield size={18} /></div><div><h2 className="font-semibold text-white">Access & security</h2><p className="mt-1 text-xs text-white/35">Permissions are enforced server-side on every protected route.</p></div></div><div className="mt-5"><InfoRow label="Role" value={<span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs capitalize text-violet-200">{spaceRole}</span>} /><InfoRow label="Access level" value={roleDescription} /><InfoRow label="Session" value={<span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 size={14} />Authenticated</span>} /></div></section>
        </div>

        <section className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><Building2 size={18} /></div><div><h2 className="font-semibold text-white">Space & ClickUp connection</h2><p className="mt-1 text-xs leading-5 text-white/35">Videos, viewer links, sessions, and analytics are scoped to this authorized Space.</p></div></div>{!workspace && <a href="/api/auth/clickup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500">Connect ClickUp <ExternalLink size={13} /></a>}</div>{workspace ? <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-white/7 bg-black/10 p-4"><p className="text-xs text-white/35">Workspace</p><p className="mt-2 truncate text-sm font-semibold text-white">{access?.space.name ?? workspace.name}</p></div><div className="rounded-xl border border-white/7 bg-black/10 p-4"><p className="text-xs text-white/35">ClickUp Team ID</p><code className="mt-2 block truncate text-xs text-white/65">{workspace.clickup_team_id}</code></div><div className="rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-4"><p className="text-xs text-white/35">Connection</p><p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-300" />Connected</p></div></div> : <div className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">No authorized Space or ClickUp workspace is connected. Reconnect ClickUp to load scoped data.</div>}</section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><KeyRound size={18} /></div><div><h2 className="font-semibold text-white">Authentication</h2><p className="mt-1 text-xs text-white/35">TrackUp keeps the internal viewer authenticated and does not expose provider URLs as access links.</p></div></div><div className="mt-5 space-y-3"><div className="flex items-center gap-3 rounded-xl border border-white/7 bg-black/10 p-3 text-sm text-white/65"><CheckCircle2 size={15} className="text-emerald-300" />ClickUp-connected sign-in required</div><div className="flex items-center gap-3 rounded-xl border border-white/7 bg-black/10 p-3 text-sm text-white/65"><CheckCircle2 size={15} className="text-emerald-300" />Space scope checked server-side</div></div></section>

          <section className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300"><SlidersHorizontal size={18} /></div><div><h2 className="font-semibold text-white">Measurement preferences</h2><p className="mt-1 text-xs text-white/35">These rules are intentionally provider-aware and are not editable toggles.</p></div></div><div className="mt-5 space-y-3"><div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="text-sm font-medium text-white/75">Native/API telemetry only</p><p className="mt-1 text-xs leading-5 text-white/35">Watch time and completion appear only when the provider reports reliable playback position and duration.</p></div><div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="text-sm font-medium text-white/75">Heatmaps stay disabled</p><p className="mt-1 text-xs leading-5 text-white/35">Point-in-time events do not become watched ranges until continuous reconstruction is reliable.</p></div></div></section>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/30"><ExternalLink size={13} />Need to reconnect or change ClickUp authorization? Use the authenticated ClickUp flow; TrackUp will return you to the requested workspace route.</div>
      </div>
    </div>
  );
}
