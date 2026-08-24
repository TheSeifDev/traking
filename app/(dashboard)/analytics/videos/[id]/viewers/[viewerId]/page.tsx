import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { getVideoViewerAnalytics } from "@/src/lib/videos/service";
import { getSafeSpaceDisplayName } from "@/src/lib/spaces/labels";
import { EmptyAnalytics, SessionList, ViewerIdentityCard } from "@/src/components/dashboard/AnalyticsDetail";

interface Props {
  params: Promise<{ id: string; viewerId: string }>;
  searchParams?: Promise<{ space_id?: string }>;
}

export default async function ViewerAnalyticsPage({ params, searchParams }: Props) {
  const { id, viewerId } = await params;
  const user = await guardAuth();
  const query = await searchParams;
  const requestedSpaceId = query?.space_id?.trim() || null;
  const resolution = await resolveActiveSpaceForUser(user, { requestedSpaceId });
  if (resolution.requestedSpaceInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");
  if (!resolution.access) return <EmptyAnalytics title="No accessible Space" body="Join a Space before opening viewer analytics." />;
  const access = resolution.access;
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!canManage) return <EmptyAnalytics title="Space admin access required" body="Viewer analytics are restricted to the platform owner and active Space admins." />;
  if (!access.space.clickup_workspace_id) return <EmptyAnalytics title="No ClickUp Workspace connected" body="Connect ClickUp before opening viewer analytics." />;
  const analytics = await getVideoViewerAnalytics(id, access.space.clickup_workspace_id, decodeURIComponent(viewerId), access.space.id);
  if (!analytics || !analytics.viewer) return <EmptyAnalytics title="Viewer analytics unavailable" body="This viewer is not present in the selected video or the analytics record is outside your Space." />;
  const scopeQuery = `?space_id=${encodeURIComponent(access.space.id)}`;
  const displaySpaceName = getSafeSpaceDisplayName(access.space.name, access.organization?.name);

  return <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7"><div className="mx-auto max-w-[1200px] space-y-7"><header className="flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><Link href={`/analytics/videos/${id}${scopeQuery}`} className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white" aria-label="Back to video analytics"><ArrowLeft size={16} /></Link><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">{access.organization?.name ?? "Organization"} / {displaySpaceName} · viewer analytics</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{analytics.viewer.viewer_name || analytics.viewer.viewer_email || (analytics.viewer.viewer_status === "identified" ? "Authenticated viewer" : "Legacy viewer")}</h1><p className="mt-2 text-sm text-white/40">{analytics.video_title} · {analytics.sessions.length} session{analytics.sessions.length === 1 ? "" : "s"}</p></div></div><Link href={`/analytics/videos/${id}${scopeQuery}`} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"><Users size={14} />All video viewers</Link></header><ViewerIdentityCard viewer={analytics.viewer} /><section className="space-y-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Session history</p><h2 className="mt-2 text-lg font-semibold text-white">Sessions for this viewer</h2><p className="mt-1 text-sm text-white/40">Open a session to inspect actual event order, timestamps, watch time, position, and coverage availability.</p></div><SessionList sessions={analytics.sessions} /></section></div></div>;
}
