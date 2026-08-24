import Link from "next/link";
import { notFound } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { getOrganizationForUser, listOrganizationMembers } from "@/src/lib/organizations/service";
import type { OrganizationMemberView } from "@/src/lib/organizations/service";

type PageProps = { params: Promise<{ organizationId: string }> };

function organizationRole(member: OrganizationMemberView): "OWNER" | "ADMIN" | "MEMBER" {
  if (member.profile.role === "owner") return "OWNER";
  return member.role === "admin" ? "ADMIN" : "MEMBER";
}

function roleClasses(role: "OWNER" | "ADMIN" | "MEMBER"): string {
  if (role === "OWNER") return "bg-amber-400/10 text-amber-200";
  if (role === "ADMIN") return "bg-violet-400/10 text-violet-200";
  return "bg-white/[0.06] text-white/65";
}

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

  return (
    <main className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <Link href={`/organizations/${organizationId}`} className="text-xs text-violet-300 hover:text-violet-200">
          ← {access.organization.name}
        </Link>
        <header>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Organization members</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{access.organization.name}</h1>
          <p className="mt-2 text-sm text-white/45">Organization role is shown separately from each person’s access to individual Spaces.</p>
        </header>
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          <div className="divide-y divide-white/8">
            {members.length === 0 ? (
              <p className="p-8 text-sm text-white/45">No organization members are recorded.</p>
            ) : (
              members.map((member) => {
                const role = organizationRole(member);
                return (
                  <div key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{member.profile.name || member.profile.email}</p>
                      <p className="mt-1 truncate text-xs text-white/40">{member.profile.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${roleClasses(role)}`}>{role}</span>
                      <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/75">{member.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
