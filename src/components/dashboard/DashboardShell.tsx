"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Video, BarChart3, Settings, LogOut, UsersRound, Link2 } from "lucide-react";
import type { UserRole } from "@/src/types/auth";
import PresenceHeartbeat from "@/src/components/dashboard/PresenceHeartbeat";

interface DashboardShellProps {
  children: React.ReactNode;
  user: { name: string | null; email: string; role: UserRole };
  workspace: { name: string } | null;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Videos", href: "/videos", icon: Video },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Watch links", href: "/watch-links", icon: Link2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const teamNavItem = { label: "Team", href: "/admin/users", icon: UsersRound };

export default function DashboardShell({ children, user, workspace }: DashboardShellProps) {
  const pathname = usePathname();
  const visibleNavItems = user.role === "owner" || user.role === "admin" ? [...navItems, teamNavItem] : navItems;

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <>
      <PresenceHeartbeat />
      <div className="flex h-screen overflow-hidden bg-[#070720] text-white">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/8 bg-[#0b0b28] lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-white/8 px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg">
              <Image src="/logo.webp" alt="TrackUp" width={205} height={58} priority className="h-8 w-auto lg:h-9" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-white">TrackUp</span>
          </Link>
        </div>

        {workspace && (
          <div className="px-4 pt-4">
            <div className="rounded-lg border border-white/8 bg-white/5 px-3 py-2">
              <p className="mb-0.5 text-[10px] uppercase tracking-widest text-white/40">Workspace</p>
              <p className="truncate text-sm font-medium text-white/80">{workspace.name}</p>
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 pt-4">
          {visibleNavItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${active ? "border border-violet-500/20 bg-violet-600/20 text-violet-300" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>
                <Icon size={16} className={active ? "text-violet-400" : "text-white/40"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-white/8 px-3 pb-4 pt-4">
          <div className="rounded-xl bg-white/4 px-3 py-2">
            <p className="truncate text-sm font-medium text-white/80">{user.name ?? user.email}</p>
            <p className="truncate text-[11px] text-white/40">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">{user.role}</span>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400">
              <LogOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-[#0b0b28]/95 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="TrackUp dashboard">
            <Image src="/logo.webp" alt="TrackUp" width={44} height={44} priority className="h-8 w-8 shrink-0 object-contain" />
            <div className="min-w-0"><span className="block text-sm font-semibold text-white">TrackUp</span>{workspace && <span className="block max-w-28 truncate text-[10px] text-white/35">{workspace.name}</span>}</div>
          </Link>
          <nav aria-label="Mobile navigation" className="flex max-w-[62vw] shrink-0 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleNavItems.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition-colors ${isActive(href) ? "bg-violet-500/15 text-violet-300" : "text-white/45 hover:bg-white/5 hover:text-white"}`} aria-label={label}>
                <Icon size={16} />
                <span className="hidden min-[430px]:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      </div>
    </>
  );
}
