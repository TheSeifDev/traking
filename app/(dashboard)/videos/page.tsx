"use server";

import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import VideoList from "@/src/components/dashboard/VideoList";

type PageProps = { searchParams?: Promise<{ space_id?: string; organization_id?: string }> };

export default async function VideosPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const resolution = await resolveActiveSpaceForUser(user, {
    requestedSpaceId: params?.space_id?.trim() || null,
    requestedOrganizationId: params?.organization_id?.trim() || null,
  });
  if (resolution.requestedSpaceInvalid || resolution.requestedOrganizationInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");

  if (resolution.context.type === "all") {
    if (!resolution.organization) redirect("/spaces?error=forbidden");
    return <VideoList role={user.role} organizationId={resolution.organization.id} spaceId={null} spaceCanManage={false} />;
  }

  const access = resolution.access;
  const spaceId = resolution.space?.id ?? null;
  const spaceCanManage = Boolean(access?.is_platform_owner || access?.membership?.role === "admin");
  return <VideoList role={user.role} spaceId={spaceId} spaceCanManage={spaceCanManage} />;
}
