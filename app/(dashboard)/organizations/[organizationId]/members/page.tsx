import Link from "next/link";
import { guardAuth } from "@/src/lib/auth/guards";
import { getOrganizationForUser, listOrganizationMembers } from "@/src/lib/organizations/service";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function OrganizationMembersPage({ params }: PageProps) {
  const user = await guardAuth();
  const { organizationId } = await params;
  let access;
  let members;
  try {
    access = await getOrganizationForUser(organizationId, user);
    members = await listOrganizationMembers(organizationId, user);
  } catch {
    notFound();
  }
  if (!access || !members) notFound();
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  return <main className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1200px] space-y-6"><Link href={`/organizations/${organizationId}`} className="text-xs text-violet-300 hover:text-violet-200">← {access.organization.name}</Link><header><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Organization members</p><h1 className="mt-3 text-3xl font-semibold text-white">{access.organization.name}</h1><p className="mt-2 text-sm text-white/45">Organization roles do not replace explicit Space assignment for ordinary members.</p></header><section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="divide-y divide-white/8">{members.length === 0 ? <p className="p-8 text-sm text-white/45">No organization members are recorded.</p> : members.map((member) => <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-white">{member.profile.name || member.profile.email}</p><p className="mt-1 text-xs text-white/40">{member.profile.email} · {member.role} · {member.status}</p></div>{canManage && <Link href={`/organizations/${organizationId}/members/${member.profile_id}`} className="text-sm text-violet-300 hover:text-violet-200">Open User 360 →</Link>}</div>)}</div></section></div></main>;
}
