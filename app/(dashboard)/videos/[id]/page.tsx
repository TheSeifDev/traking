import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, ExternalLink, Link2, Play, Video } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getVideo, getVideoAnalytics } from "@/src/lib/videos/service";
import { getAppUrl } from "@/src/lib/app-url";
import WatchLinkPanel from "@/src/components/dashboard/WatchLinkPanel";
import VideoAnalyticsDashboard from "@/src/components/dashboard/VideoAnalyticsDashboard";

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ space_id?: string; organization_id?: string }>;
}

function getYouTubeId(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    const candidate = url.hostname.includes("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop();
    return candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate) ? candidate : null;
  } catch { return null; }
}

function capability(sourceType: string): string {
  if (sourceType === "direct_url") return "Native HTML5 playback telemetry";
  if (sourceType === "youtube") return "Official YouTube IFrame API telemetry";
  return "Session-only measurement; provider playback callbacks unavailable";
}

export default async function VideoDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const user = await guardAuth();
  const query = await searchParams;
  const requestedSpaceId = query?.space_id?.trim() || null;
  const requestedOrganizationId = query?.organization_id?.trim() || null;
  const resolution = await resolveActiveSpaceForUser(user, { requestedSpaceId, requestedOrganizationId });
  if (resolution.requestedSpaceInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");
  const access = resolution.access;
  const scope = resolution.context.type === "all"
    ? resolution.organization ? organizationDataScope(resolution.organization) : null
    : access ? spaceDataScope(access.space) : null;
  if (!scope) notFound();
  const [video, analytics] = await Promise.all([
    getVideo(id, scope),
    getVideoAnalytics(id, scope),
  ]);
  if (!video) notFound();
  const canManage = resolution.context.type !== "all" && Boolean(access?.is_platform_owner || access?.membership?.role === "admin");
  const spaceId = access?.space.id ?? null;
  const spaceName = access?.space.name ?? "All Spaces";
  const organizationId = resolution.organization?.id ?? access?.organization?.id ?? null;
  const youtubeId = video.source_type === "youtube" ? getYouTubeId(video.source_url) : null;
  const now = new Date().getTime();
  const activeLink = video.watch_links?.find((link) => !link.revoked_at && !(link.expires_at && new Date(link.expires_at).getTime() <= now));
  const scopeQuery = resolution.context.type === "all" && organizationId
    ? `?organization_id=${encodeURIComponent(organizationId)}`
    : spaceId ? `?space_id=${encodeURIComponent(spaceId)}` : "";
  const videoHref = `/videos/${video.id}${scopeQuery}`;

  return <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.11),transparent_35%)] p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-6 lg:space-y-8"><header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><Link href={`/videos${scopeQuery}`} className="mt-1 shrink-0 rounded-xl border border-white/8 bg-white/[0.03] p-2 text-white/45 transition hover:border-white/20 hover:text-white" aria-label="Back to video library"><ArrowLeft size={17} /></Link><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/70">{spaceName} · video</p><h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">{video.title}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/40"><span className="rounded-full border border-violet-400/15 bg-violet-500/10 px-2.5 py-1 capitalize text-violet-200">{video.source_type.replace("_", " ")}</span><span>Added {new Date(video.created_at).toLocaleDateString()}</span></div></div></div><div className="flex flex-wrap gap-2"><Link href={`/analytics${scopeQuery}&video=${encodeURIComponent(video.id)}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"><BarChart3 size={14} />Space analytics</Link>{activeLink && <a href={`${getAppUrl()}/watch/${activeLink.token}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500"><Play size={14} />Open viewer</a>}</div></header><section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]"><article className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] shadow-xl shadow-black/10"><div className="aspect-video bg-black/20">{youtubeId ? <div role="img" aria-label={`Thumbnail for ${video.title}`} className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg)` }}><div className="flex h-full items-center justify-center bg-gradient-to-t from-[#070720]/75 via-transparent to-transparent"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-violet-700 shadow-xl"><Play size={22} fill="currentColor" /></div></div></div> : <div className="flex h-full items-center justify-center text-white/20"><Video size={42} /></div>}</div><div className="p-5 sm:p-6">{video.description && <p className="text-sm leading-6 text-white/45">{video.description}</p>}<div className={`${video.description ? "mt-5" : ""} grid gap-3 sm:grid-cols-2`}><div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="text-[11px] text-white/35">Measurement scope</p><p className="mt-1 text-xs font-medium leading-5 text-white/70">{capability(video.source_type)}</p></div><div className="rounded-xl border border-white/7 bg-black/10 p-3"><p className="text-[11px] text-white/35">TrackUp viewer</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300"><CheckCircle2 size={13} />Internal /watch page</p></div></div></div></article><article className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 shadow-xl shadow-black/10 sm:p-6"><div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Link2 size={18} /></div><div><h2 className="font-semibold text-white">Viewer access</h2><p className="mt-1 text-xs leading-5 text-white/35">Share a TrackUp viewer URL. The original provider URL is never the viewer destination.</p></div></div><WatchLinkPanel videoId={video.id} existingLinks={video.watch_links ?? []} canManage={canManage} appOrigin={getAppUrl()} spaceId={spaceId} detailsHref={videoHref} /></article></section>{analytics ? <VideoAnalyticsDashboard video={video} analytics={analytics} /> : <div className="rounded-2xl border border-dashed border-red-300/20 bg-red-300/5 p-10 text-center"><p className="text-sm text-red-100">Analytics are temporarily unavailable.</p><p className="mt-2 text-xs text-red-100/50">The video is still available, but the server could not read its tracking records.</p></div>}<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/30"><ExternalLink size={13} />Provider limitations remain visible in analytics. TrackUp does not fabricate playback, completion, or heatmap data.</div></div></div>;
}
