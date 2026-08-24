"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Video, BarChart3, Settings, LogOut, UsersRound, Link2, ShieldCheck, Building2 } from "lucide-react";
import type { UserRole } from "@/src/types/auth";
import { useEffect } from "react";
import type { AccessibleOrganization, AccessibleSpace } from "@/src/types/space";
import type { ActiveSpaceContext } from "@/src/lib/spaces/active-space";
import PresenceHeartbeat from "@/src/components/dashboard/PresenceHeartbeat";
import { getSpaceDisplayName, isSelectableChildSpace } from "@/src/lib/spaces/labels";

interface DashboardShellProps {
  children: React.ReactNode;
  user: { name: string | null; email: string; role: UserRole };
  workspace: { name: string } | null;
  spaces?: AccessibleSpace[];
  organizations?: AccessibleOrganization[];
  activeSpaceId?: string | null;
  activeOrganizationId?: string | null;
  activeSpaceNeedsPersistence?: boolean;
  activeSpacePreferenceInvalid?: boolean;
  activeSpaceContext?: ActiveSpaceContext;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Organizations", href: "/organizations", icon: Building2 },
  { label: "Spaces", href: "/spaces", icon: LayoutDashboard },
  { label: "Videos", href: "/videos", icon: Video },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Watch links", href: "/watch-links", icon: Link2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const ownerNavItem = { label: "Owner console", href: "/owner", icon: ShieldCheck };

export default function DashboardShell({
  children,
  user,
  workspace,
  spaces = [],
  organizations = [],
  activeSpaceId = null,
  activeOrganizationId = null,
  activeSpaceNeedsPersistence = false,
  activeSpacePreferenceInvalid = false,
  activeSpaceContext = { type: "none", organizationId: null },
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeSpaceId = pathname.match(/^\/spaces\/([^/]+)/)?.[1] ?? searchParams.get("space_id");
  const routeSpace = spaces.find((space) => space.id === routeSpaceId) ?? null;
  const requestedOrganizationId = searchParams.get("organization_id");
  const selectedOrganizationId = routeSpace?.organization_id
    ?? (activeOrganizationId && organizations.some((organization) => organization.id === activeOrganizationId) ? activeOrganizationId : null)
    ?? (requestedOrganizationId && organizations.some((organization) => organization.id === requestedOrganizationId) ? requestedOrganizationId : organizations[0]?.id ?? "");
  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
  const displayedOrganizationRole = selectedOrganization
    ? selectedOrganization.is_platform_owner
      ? "owner"
      : selectedOrganization.membership_role ?? user.role
    : user.role;
  const hasOrganizationSelector = organizations.length > 1;
  const selectOrganization = (organizationId: string) => {
    router.push(`/dashboard?organization_id=${encodeURIComponent(organizationId)}`);
  };
  const selectableSpaces = spaces.filter((space) => space.organization_id === selectedOrganizationId)
    .filter((space) => isSelectableChildSpace(space, selectedOrganization?.name));
  const persistedSpace = selectableSpaces.find((space) => space.id === activeSpaceId) ?? null;
  const selectedSpace = routeSpace && routeSpace.organization_id === selectedOrganizationId
    ? routeSpace
    : persistedSpace;
  const selectedSpaceId = selectedSpace?.id ?? "";
  const canManageActiveSpace = Boolean(selectedSpace?.is_platform_owner || selectedSpace?.membership_role === "admin");
  const organizationMembersNavItem = selectedOrganizationId
    ? { label: "Members", href: `/organizations/${encodeURIComponent(selectedOrganizationId)}/members`, icon: UsersRound }
    : null;
  const spaceMembersNavItem = selectedSpaceId && canManageActiveSpace
    ? { label: "Space members", href: `/spaces/${selectedSpaceId}/members`, icon: UsersRound }
    : null;
  const visibleNavItems = [
    navItems[0],
    navItems[1],
    ...(organizationMembersNavItem ? [organizationMembersNavItem] : []),
    ...navItems.slice(2),
    ...(spaceMembersNavItem ? [spaceMembersNavItem] : []),
    ...(user.role === "owner" ? [ownerNavItem] : []),
  ];

  useEffect(() => {
    if (!activeSpaceNeedsPersistence && !activeSpacePreferenceInvalid) return;
    const request = activeSpaceContext.type === "all" && activeOrganizationId
      ? { scope: "all", organization_id: activeOrganizationId }
      : activeSpaceId
        ? { scope: "specific", space_id: activeSpaceId }
        : null;
    if (request) {
      void fetch("/api/spaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    } else {
      void fetch("/api/spaces/active", { method: "DELETE" });
    }
  }, [activeOrganizationId, activeSpaceContext.type, activeSpaceId, activeSpaceNeedsPersistence, activeSpacePreferenceInvalid]);

  const scopedHref = (href: string) => {
    if (href === "/organizations" || href === "/owner" || href.startsWith("/spaces/") || href.startsWith("/organizations/")) return href;
    if (href === "/spaces") return selectedOrganizationId ? `${href}?organization_id=${encodeURIComponent(selectedOrganizationId)}` : href;
    if (!selectedSpaceId && activeSpaceContext.type === "all" && selectedOrganizationId && ["/dashboard", "/videos", "/analytics", "/watch-links"].includes(href)) {
      return `${href}?organization_id=${encodeURIComponent(selectedOrganizationId)}`;
    }
    if (!selectedSpaceId) return href;
    return `${href}?space_id=${encodeURIComponent(selectedSpaceId)}`;
  };

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/organizations") return pathname === "/organizations" || (pathname.startsWith("/organizations/") && !pathname.includes("/members"));
    if (href.includes("/members")) return pathname === href || pathname.startsWith(`${href}/`);
    return pathname.startsWith(href);
  }

  const organizationContext = selectedOrganization?.name ?? workspace?.name ?? null;
  const spaceContext = selectedSpace ? getSpaceDisplayName(selectedSpace) : null;
  const displayedSpaceContext = activeSpaceContext.type === "all"
    ? "All Spaces"
    : spaceContext ?? (selectableSpaces.length > 1 ? "Select a Space" : selectableSpaces.length === 0 ? "No accessible Spaces" : "Select a Space");

  return (
    <>
      <PresenceHeartbeat />
      <div className="flex h-screen overflow-hidden bg-[#070720] text-white">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/8 bg-[#0b0b28] lg:flex">
          <div className="flex h-16 shrink-0 items-center border-b border-white/8 px-5">
            <Link href={scopedHref("/dashboard")} className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg">
                <Image src="/logo.webp" alt="TrackUp" width={128} height={128} priority className="h-8 w-8 object-contain lg:h-9 lg:w-9" />
              </div>
              <span className="text-sm font-semibold tracking-wide text-white">TrackUp</span>
            </Link>
          </div>

          <div className="space-y-3 px-4 pt-4" aria-label="Current context">
            {organizationContext && (
              <div className="min-w-0 px-1 py-1">
                <span className="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Organization</span>
                {hasOrganizationSelector ? <select aria-label="Select Organization" value={selectedOrganizationId} onChange={(event) => selectOrganization(event.target.value)} className="block w-full min-w-0 rounded-lg border border-white/10 bg-[#0b0b28] px-2 py-1.5 text-sm font-medium text-white/80 outline-none focus:border-violet-300/50">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select> : <p className="truncate text-sm font-medium text-white/80" title={organizationContext}>{organizationContext}</p>}
              </div>
            )}

            <div className="min-w-0 px-1 py-1">
              <span className="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Space</span>
              <p className="truncate text-sm font-medium text-white/65" title={displayedSpaceContext}>{displayedSpaceContext}</p>
            </div>

            {organizations.length === 0 && !selectableSpaces.length && workspace && (
              <div className="min-w-0 px-1 py-1">
                <p className="mb-0.5 text-[10px] uppercase tracking-widest text-white/40">ClickUp connection</p>
                <p className="truncate text-sm font-medium text-white/80">{workspace.name}</p>
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1 px-3 pt-4">
            {visibleNavItems.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return <Link key={href} href={scopedHref(href)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${active ? "border border-violet-500/20 bg-violet-600/20 text-violet-300" : "text-white/50 hover:bg-white/5 hover:text-white"}`}><Icon size={16} className={active ? "text-violet-400" : "text-white/40"} />{label}</Link>;
            })}
          </nav>

          <div className="space-y-1 border-t border-white/8 px-3 pb-4 pt-4">
            <div className="rounded-xl bg-white/4 px-3 py-2">
              <p className="truncate text-sm font-medium text-white/80">{user.name ?? user.email}</p>
              <p className="truncate text-[11px] text-white/40">{user.email}</p>
              <span className="mt-1 inline-block rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">{displayedOrganizationRole}</span>
            </div>
            <form action="/api/auth/logout" method="POST"><button type="submit" className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400"><LogOut size={15} />Sign out</button></form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-[#0b0b28]/95 px-4 backdrop-blur lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link href={scopedHref("/dashboard")} className="shrink-0" aria-label="TrackUp dashboard"><Image src="/logo.webp" alt="TrackUp" width={64} height={64} priority className="h-8 w-8 object-contain" /></Link>
              <div className="min-w-0"><span className="block text-sm font-semibold text-white">TrackUp</span>{hasOrganizationSelector ? <select aria-label="Select Organization" value={selectedOrganizationId} onChange={(event) => selectOrganization(event.target.value)} className="block max-w-32 truncate rounded border border-white/10 bg-[#0b0b28] px-1 text-[10px] text-white/70 outline-none focus:border-violet-300/50">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select> : <span className="block max-w-28 truncate text-[10px] text-white/35" title={organizationContext ?? undefined}>{organizationContext ?? "No Organization"}</span>}<span className="block max-w-28 truncate text-[10px] text-violet-200/55" title={displayedSpaceContext}>{displayedSpaceContext}</span></div>
            </div>
            <nav aria-label="Mobile navigation" className="flex max-w-[62vw] shrink-0 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleNavItems.map(({ label, href, icon: Icon }) => <Link key={href} href={scopedHref(href)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition-colors ${isActive(href) ? "bg-violet-500/15 text-violet-300" : "text-white/45 hover:bg-white/5 hover:text-white"}`} aria-label={label}><Icon size={16} /><span className="hidden min-[430px]:inline">{label}</span></Link>)}
            </nav>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </>
  );
}
