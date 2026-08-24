import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ShieldCheck } from "lucide-react";
import { guardAuth } from "@/src/lib/auth/guards";
import { getOrganizationForUser } from "@/src/lib/organizations/service";

export default async function OrganizationSettingsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const user = await guardAuth();
  const { organizationId } = await params;
  let access;
  try {
    access = await getOrganizationForUser(organizationId, user);
  } catch {
    notFound();
  }
  if (!access) notFound();
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  return <main className="min-h-full bg-[#08081f] px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1000px] space-y-7"><Link href={`/organizations/${organizationId}`} className="text-xs text-violet-300 hover:text-violet-200">← {access.organization.name}</Link><header className="border-b border-white/8 pb-7"><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">Organization settings</p><h1 className="mt-3 text-3xl font-semibold">{access.organization.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Administrative identity and access context for this Organization. Space settings remain scoped to each individual Space.</p></header><section className="grid gap-4 sm:grid-cols-2"><SettingCard label="Organization identity" value={access.organization.id} detail={`Slug · ${access.organization.slug}`} icon={Building2} /><SettingCard label="Your Organization access" value={access.is_platform_owner ? "Platform owner" : access.membership?.role === "admin" ? "Organization admin" : "Organization member"} detail={canManage ? "Can manage Organization membership and organization-wide Space visibility." : "Organization membership does not grant every Space; explicit Space membership is still required."} icon={ShieldCheck} /></section><section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"><p className="text-[10px] uppercase tracking-[0.2em] text-white/30">ClickUp relationship</p><h2 className="mt-2 text-lg font-semibold">Optional identity and synchronization</h2><p className="mt-3 text-sm leading-6 text-white/45">A ClickUp Workspace can be linked to this Organization for identity and conservative synchronization. It is not automatically converted into a TrackUp Space.</p><p className="mt-5 break-all rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-xs text-white/55">{access.organization.clickup_workspace_id ? `Linked ClickUp Workspace · ${access.organization.clickup_workspace_id}` : "No ClickUp Workspace linked"}</p></section></div></main>;
}

function SettingCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Building2 }) {
  return <article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5"><Icon size={18} className="text-violet-200" /><p className="mt-5 text-[10px] uppercase tracking-[0.15em] text-white/30">{label}</p><p className="mt-2 break-all text-sm font-semibold text-white/85">{value}</p><p className="mt-2 text-xs leading-5 text-white/40">{detail}</p></article>;
}
