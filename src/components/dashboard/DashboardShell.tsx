"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Video, BarChart3, Settings, LogOut } from "lucide-react";
import Image from "next/image";

interface DashboardShellProps {
  children: React.ReactNode;
  user: { name: string | null; email: string; role: string };
  workspace: { name: string } | null;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Videos", href: "/videos", icon: Video },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardShell({ children, user, workspace }: DashboardShellProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen bg-[#070720] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/8 bg-[#0b0b28]">
        {/* Logo */}
        <div className="flex items-center h-16 px-5 border-b border-white/8 shrink-0 ">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center">
                        <Image
                          src="/logo.webp"
                          alt="TrackUp"
                          width={205}
                          height={58}
                          priority
                          className="h-8 w-auto lg:h-9"
                        />
            </div>
            <span className="font-semibold text-white text-sm tracking-wide">TrackUp</span>
          </Link>
        </div>

        {/* Workspace badge */}
        {workspace && (
          <div className="px-4 pt-4">
            <div className="rounded-lg bg-white/5 px-3 py-2 border border-white/8">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Workspace</p>
              <p className="text-sm text-white/80 font-medium truncate">{workspace.name}</p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/20"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={16} className={active ? "text-violet-400" : "text-white/40"} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 pb-4 border-t border-white/8 pt-4 space-y-1">
          <div className="px-3 py-2 rounded-xl bg-white/4">
            <p className="text-sm text-white/80 font-medium truncate">{user.name ?? user.email}</p>
            <p className="text-[11px] text-white/40 truncate">{user.email}</p>
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 uppercase tracking-wide">
              {user.role}
            </span>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-white/8 bg-[#0b0b28] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-linear-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">T</span>
            </div>
            <span className="font-semibold text-sm">TrackUp</span>
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map(({ href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`p-2 rounded-lg transition-colors ${
                  isActive(href) ? "text-violet-400 bg-violet-500/10" : "text-white/40 hover:text-white"
                }`}
              >
                <Icon size={18} />
              </Link>
            ))}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}