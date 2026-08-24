import Link from "next/link";
import { notFound } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getOrganizationForUser, listOrganizationSpaces } from "@/src/lib/organizations/service";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function OrganizationSpacesPage({ params }: PageProps) {
  const user = await guardAuth();
  const { organizationId } = await params;
  let access;
  let spaces;
  try {
    access = await getOrganizationForUser(organizationId, user);
    spaces = await listOrganizationSpaces(organizationId, user);
  } catch {
    notFound();
  }
  if (!access || !spaces) notFound();
  return <main className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1200px] space-y-6"><Link href={`/organizations/${organizationId}`} className="text-xs text-violet-300 hover:text-violet-200">← {access.organization.name}</Link><header><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Organization Spaces</p><h1 className="mt-3 text-3xl font-semibold text-white">Operational boundaries</h1><p className="mt-2 text-sm text-white/45">Each Space owns its video, viewer-link, session, event, and analytics scope.</p></header><section className="grid gap-4 md:grid-cols-2">{spaces.length === 0 ? <div className="rounded-3xl border border-dashed border-white/12 p-10 text-sm text-white/45">No active Spaces are attached.</div> : spaces.map((space) => <Link key={space.id} href={`/spaces/${space.id}`} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-violet-300/30"><p className="text-lg font-semibold text-white">{space.name}</p><p className="mt-1 text-xs text-white/40">/{space.slug}</p><p className="mt-5 text-xs text-violet-300">Open Space dashboard →</p></Link>)}</section></div></main>;
}
