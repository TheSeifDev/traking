import Link from "next/link";
import { guardAuth } from "@/src/lib/auth/guards";
import { getSpaceForUser } from "@/src/lib/spaces/service";
import { listSpaceMembers } from "@/src/lib/spaces/service";
import SpaceMembersManager from "@/src/components/spaces/SpaceMembersManager";

type PageContext = { params: Promise<{ spaceId: string }> };

export default async function SpaceMembersPage({ params }: PageContext) {
  const user = await guardAuth();
  const { spaceId } = await params;
  let access;
  try {
    access = await getSpaceForUser(spaceId, user);
  } catch {
    return <DeniedState />;
  }
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!canManage) return <DeniedState />;
  const members = await listSpaceMembers(spaceId, user);
  if (members === null) return <DeniedState />;
  return <SpaceMembersManager spaceId={spaceId} initialMembers={members} clickupConnected={Boolean(access.space.clickup_workspace_id)} />;
}

function DeniedState() {
  return <div className="flex min-h-full items-center justify-center bg-[#08081f] px-6 py-12 text-center"><div><h1 className="text-xl font-semibold text-white">Space admin access required</h1><p className="mt-2 text-sm text-white/40">This page manages one Space and is not available to this account.</p><Link href="/spaces" className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white">Back to Spaces</Link></div></div>;
}
