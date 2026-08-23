import Link from "next/link";
import { Activity, ArrowRight, Link2, ShieldCheck, Video } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getAppUrl } from "@/src/lib/app-url";
import { listVideos } from "@/src/lib/videos/service";
import WatchLinkPanel from "@/src/components/dashboard/WatchLinkPanel";

export default async function WatchLinksPage() {
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  const videos = workspaceId ? await listVideos(workspaceId) : [];
  const canManage = user.role === "owner" || user.role === "admin";
  const now = new Date().getTime();
  const activeLinks = videos.reduce((total, video) => total + (video.watch_links?.filter((link) => !link.revoked_at && !(link.expires_at && new Date(link.expires_at).getTime() <= now)).length ?? 0), 0);
  const historicalLinks = videos.reduce((total, video) => total + (video.watch_links?.filter((link) => Boolean(link.revoked_at)).length ?? 0), 0);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.11),transparent_35%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7 lg:space-y-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/70">Access management</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight text-white"><Link2 size={25} className="text-violet-300" />Watch links</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Manage the single active TrackUp viewer URL for each video. Viewers stay inside TrackUp; revoked history remains available for audit.</p></div><Link href="/videos" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white">Open video library <ArrowRight size={15} /></Link></header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4"><div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4 sm:p-5"><div className="flex items-center gap-2 text-xs font-medium text-emerald-200/70"><Activity size={15} />Active links</div><p className="mt-4 text-3xl font-semibold text-white">{activeLinks}</p><p className="mt-1 text-xs text-white/35">At most one per video</p></div><div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:p-5"><div className="flex items-center gap-2 text-xs font-medium text-white/50"><Video size={15} />Videos</div><p className="mt-4 text-3xl font-semibold text-white">{videos.length}</p><p className="mt-1 text-xs text-white/35">Workspace-scoped library</p></div><div className="col-span-2 rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:col-span-1 sm:p-5"><div className="flex items-center gap-2 text-xs font-medium text-white/50"><ShieldCheck size={15} />Revoked history</div><p className="mt-4 text-3xl font-semibold text-white">{historicalLinks}</p><p className="mt-1 text-xs text-white/35">Retained for audit</p></div></section>

        {!workspaceId ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center"><Link2 size={32} className="mx-auto mb-3 text-white/15" /><p className="text-sm text-white/50">Connect a ClickUp workspace before managing watch links.</p></div> : videos.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center"><Video size={32} className="mx-auto mb-3 text-white/15" /><p className="text-sm text-white/50">Your workspace has no videos yet.</p><Link href="/videos" className="mt-4 inline-flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200">Add a video <ArrowRight size={14} /></Link></div> : <div className="grid gap-5 xl:grid-cols-2">{videos.map((video) => <section key={video.id} className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="mb-5 flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Video access</p><Link href={`/videos/${video.id}`} className="mt-2 block truncate text-base font-semibold text-white hover:text-violet-200">{video.title}</Link><p className="mt-1 text-xs capitalize text-white/35">{video.source_type.replace("_", " ")} · {video.view_count ?? 0} sessions</p></div><Link href={`/videos/${video.id}`} className="shrink-0 rounded-lg border border-white/8 p-2 text-white/35 transition hover:border-violet-400/25 hover:text-violet-200" aria-label={`Open ${video.title} details`}><ArrowRight size={15} /></Link></div><WatchLinkPanel videoId={video.id} existingLinks={video.watch_links ?? []} canManage={canManage} appOrigin={getAppUrl()} /></section>)}</div>}
      </div>
    </div>
  );
}
