/**
 * /videos - Space-scoped video management page
 */
import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getSpaceForUser } from "@/src/lib/spaces/service";
import { listSpacesForUser } from "@/src/lib/spaces/service";
import VideoList from "@/src/components/dashboard/VideoList";

type PageProps = { searchParams?: Promise<{ space_id?: string }> };

export default async function VideosPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const requestedSpaceId = params?.space_id?.trim() || null;
  let spaceId = requestedSpaceId;
  let spaceCanManage = false;

  if (requestedSpaceId) {
    try {
      const access = await getSpaceForUser(requestedSpaceId, user);
      spaceCanManage = access.is_platform_owner || access.membership?.role === "admin";
    } catch {
      redirect("/spaces?error=forbidden");
    }
  } else {
    const spaces = await listSpacesForUser(user);
    if (spaces.length > 1) redirect("/spaces?error=select_space");
    const onlySpace = spaces[0];
    spaceId = onlySpace?.id ?? null;
    spaceCanManage = onlySpace ? onlySpace.is_platform_owner || onlySpace.membership_role === "admin" : false;
  }

  return <VideoList role={user.role} spaceId={spaceId} spaceCanManage={spaceCanManage} />;
}
