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
    const organization = resolution.organization;
    if (!organization) redirect("/spaces?error=forbidden");
    return <VideoList
      role={user.role}
      organizationId={organization.id}
      spaceId={null}
      scopeOptions={resolution.spaces.filter((space) => space.organization_id === organization.id).map((space) => ({ id: space.id, name: space.name }))}
      spaceCanManage={user.role === "owner"}
      allowAllSpaces={user.role === "owner"}
    />;
  }

  const access = resolution.access;
  const space = resolution.space;
  const spaceId = space?.id ?? null;
  const spaceCanManage = Boolean(access?.is_platform_owner || access?.membership?.role === "admin");
  return <VideoList
    role={user.role}
    organizationId={space?.organization_id ?? null}
    spaceId={spaceId}
    scopeOptions={space ? [{ id: space.id, name: space.name }] : []}
    spaceCanManage={spaceCanManage}
    allowAllSpaces={user.role === "owner"}
  />;
}
