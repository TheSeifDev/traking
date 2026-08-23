/**
 * /videos/[id] - Video detail, watch-link controls, and analytics
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getPrimaryWorkspaceId } from "@/src/lib/clickup/workspace";
import { getVideo, getVideoAnalytics } from "@/src/lib/videos/service";
import { getAppUrl } from "@/src/lib/app-url";
import WatchLinkPanel from "@/src/components/dashboard/WatchLinkPanel";
import VideoAnalyticsDashboard from "@/src/components/dashboard/VideoAnalyticsDashboard";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VideoDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await guardAuth();
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) notFound();

  const [video, analytics] = await Promise.all([
    getVideo(id, workspaceId),
    getVideoAnalytics(id, workspaceId),
  ]);

  if (!video) notFound();

  const canManage = user.role === "owner" || user.role === "admin";

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/videos" className="rounded-xl p-2 text-white/40 transition hover:bg-white/5 hover:text-white" aria-label="Back to video library"><ArrowLeft size={18} /></Link>
          <div className="min-w-0"><p className="text-xs uppercase tracking-[0.18em] text-white/30">Video analytics</p><h1 className="truncate text-xl font-semibold text-white">{video.title}</h1></div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"><p className="text-xs uppercase tracking-[0.18em] text-white/30">Source URL</p><p className="mt-2 break-all text-sm text-white/70">{video.source_url}</p>{video.description && <p className="mt-2 text-sm leading-6 text-white/40">{video.description}</p>}</div>
        <WatchLinkPanel videoId={video.id} existingLinks={video.watch_links ?? []} canManage={canManage} appOrigin={getAppUrl()} />
        {analytics ? <VideoAnalyticsDashboard video={video} analytics={analytics} /> : <div className="rounded-3xl border border-dashed border-red-300/20 bg-red-300/5 p-10 text-center"><p className="text-sm text-red-100">Analytics are temporarily unavailable.</p><p className="mt-2 text-xs text-red-100/50">The video is still available, but the server could not read its tracking records.</p></div>}
      </div>
    </div>
  );
}
