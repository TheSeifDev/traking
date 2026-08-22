/**
 * /watch-links - Workspace-scoped watch-link management
 */
import Link from "next/link";
import { Link2, Video } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { listVideos } from "@/src/lib/videos/service";
import WatchLinkPanel from "@/src/components/dashboard/WatchLinkPanel";

export default async function WatchLinksPage() {
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  const videos = workspaceId ? await listVideos(workspaceId) : [];
  const canManage = user.role === "owner" || user.role === "admin";
  const totalLinks = videos.reduce((total, video) => total + (video.watch_links?.length ?? 0), 0);

  return (
    <div className="space-y-7 p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Viewer access</p><h1 className="mt-2 text-2xl font-bold text-white">Watch links</h1><p className="mt-1 text-sm text-white/45">Create and manage internal TrackUp URLs for your workspace videos.</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/50"><Link2 size={15} className="text-violet-300" /><strong className="text-white">{totalLinks}</strong> {totalLinks === 1 ? "link" : "links"}</div>
      </header>

      {!workspaceId ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center"><Link2 size={32} className="mx-auto mb-3 text-white/15" /><p className="text-sm text-white/50">Connect a ClickUp workspace before managing watch links.</p></div> : videos.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center"><Video size={32} className="mx-auto mb-3 text-white/15" /><p className="text-sm text-white/50">No videos are available yet.</p><Link href="/videos" className="mt-4 inline-block text-sm text-violet-300 hover:text-violet-200">Open video library</Link></div> : <div className="space-y-6">{videos.map((video) => <section key={video.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"><div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><Link href={`/videos/${video.id}`} className="font-semibold text-white hover:text-violet-200">{video.title}</Link><p className="mt-1 text-xs capitalize text-white/35">{video.source_type.replace("_", " ")}</p></div><Link href={`/videos/${video.id}`} className="text-xs text-violet-300 hover:text-violet-200">Open details</Link></div><WatchLinkPanel videoId={video.id} existingLinks={video.watch_links ?? []} canManage={canManage} /></section>)}</div>}
    </div>
  );
}
