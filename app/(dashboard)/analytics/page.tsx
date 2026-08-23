"use server";

import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getSpaceForUser, listSpacesForUser } from "@/src/lib/spaces/service";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";
import WorkspaceAnalyticsDashboard from "@/src/components/dashboard/WorkspaceAnalyticsDashboard";
import PersonalSpaceAnalytics from "@/src/components/spaces/PersonalSpaceAnalytics";
import Link from "next/link";

type PageProps = { searchParams?: Promise<{ space_id?: string }> };

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const requestedSpaceId = params?.space_id?.trim() || null;
  let access;
  if (requestedSpaceId) {
    try {
      access = await getSpaceForUser(requestedSpaceId, user);
    } catch {
      redirect("/spaces?error=forbidden");
    }
  } else {
    const spaces = await listSpacesForUser(user);
    if (spaces.length > 1) redirect("/spaces?error=select_space");
    if (!spaces[0]) return <AnalyticsEmptyState title="No accessible Space" detail="Join a Space before opening private analytics." />;
    try {
      access = await getSpaceForUser(spaces[0].id, user);
    } catch {
      redirect("/spaces?error=forbidden");
    }
  }

  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!access.space.clickup_workspace_id) return <AnalyticsEmptyState title="Connect a ClickUp Workspace" detail="Connect this Space before reading its video analytics." href={`/spaces/${access.space.id}`} />;

  if (!canManage) {
    const personalAnalytics = await getWorkspaceAnalytics(access.space.clickup_workspace_id, access.space.id, user.id);
    return <PersonalSpaceAnalytics space={{ ...access.space, membership_role: access.membership?.role ?? null, membership_status: access.membership?.status ?? null, is_platform_owner: access.is_platform_owner }} analytics={personalAnalytics} />;
  }

  const [analytics, videos] = await Promise.all([
    getWorkspaceAnalytics(access.space.clickup_workspace_id, access.space.id),
    listVideos(access.space.clickup_workspace_id, access.space.id),
  ]);
  return <div className="p-6 lg:p-8"><WorkspaceAnalyticsDashboard spaceId={access.space.id} analytics={analytics} videos={videos} /></div>;
}

function AnalyticsEmptyState({ title, detail, href }: { title: string; detail: string; href?: string }) {
  return <div className="flex min-h-full items-center justify-center bg-[#08081f] px-6 py-12 text-center"><div><h1 className="text-xl font-semibold text-white">{title}</h1><p className="mt-2 max-w-md text-sm leading-6 text-white/40">{detail}</p>{href && <Link href={href} className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white">Back to Space</Link>}</div></div>;
}
