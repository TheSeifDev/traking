"use server";

import Link from "next/link";
import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { getWorkspaceAnalytics, listVideos } from "@/src/lib/videos/service";
import WorkspaceAnalyticsDashboard from "@/src/components/dashboard/WorkspaceAnalyticsDashboard";
import PersonalSpaceAnalytics from "@/src/components/spaces/PersonalSpaceAnalytics";

type PageProps = { searchParams?: Promise<{ space_id?: string; organization_id?: string }> };

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const resolution = await resolveActiveSpaceForUser(user, {
    requestedSpaceId: params?.space_id?.trim() || null,
    requestedOrganizationId: params?.organization_id?.trim() || null,
  });
  if (resolution.requestedSpaceInvalid || resolution.requestedOrganizationInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");

  if (resolution.context.type === "all") {
    const organization = resolution.organization;
    if (!organization?.clickup_workspace_id) return <AnalyticsEmptyState title="Connect a ClickUp Workspace" detail="Connect the selected Organization before reading its analytics." />;
    const spaceIds = resolution.spaces.filter((space) => space.organization_id === organization.id).map((space) => space.id);
    const [analytics, videos] = await Promise.all([
      getWorkspaceAnalytics(organization.clickup_workspace_id, undefined, undefined, spaceIds),
      listVideos(organization.clickup_workspace_id, undefined, spaceIds),
    ]);
    return <div className="p-6 lg:p-8"><WorkspaceAnalyticsDashboard organizationId={organization.id} scopeType="all" spaceId={null} analytics={analytics} videos={videos} /></div>;
  }

  if (!resolution.access) return <AnalyticsEmptyState title="No accessible Space" detail="Join a Space before opening private analytics." />;
  const access = resolution.access;
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
  return <div className="p-6 lg:p-8"><WorkspaceAnalyticsDashboard scopeType="specific" spaceId={access.space.id} organizationId={access.space.organization_id} analytics={analytics} videos={videos} /></div>;
}

function AnalyticsEmptyState({ title, detail, href }: { title: string; detail: string; href?: string }) {
  return <div className="flex min-h-full items-center justify-center bg-[#08081f] px-6 py-12 text-center"><div><h1 className="text-xl font-semibold text-white">{title}</h1><p className="mt-2 max-w-md text-sm leading-6 text-white/40">{detail}</p>{href && <Link href={href} className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white">Back to Space</Link>}</div></div>;
}
