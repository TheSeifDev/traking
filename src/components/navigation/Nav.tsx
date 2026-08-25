"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Integrations", href: "/integrations" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "FAQ", href: "/faq" },
];

const Nav = () => {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 hidden w-full border-b transition-all duration-300 md:block ${scrolled ? "border-white/6 bg-[#050617]/75 backdrop-blur-xl" : "border-transparent bg-transparent"}`}>
      <nav className="mx-auto flex h-[4.5rem] w-full max-w-[90rem] items-center px-6 lg:px-10 xl:px-12">
        <Link href="/" aria-label="TrackUp home" className="flex shrink-0 items-center gap-2.5 transition duration-200 hover:scale-[1.02]">
          <Image src="/logo.webp" alt="TrackUp" width={128} height={128} priority className="h-8 w-8 object-contain lg:h-9 lg:w-9" />
          <span className="text-lg font-semibold tracking-[-0.04em] text-white lg:text-xl">TrackUp</span>
        </Link>

        <div className="ml-10 flex items-center gap-5 lg:ml-16 lg:gap-7 xl:ml-20 xl:gap-9">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={`group relative whitespace-nowrap py-2 text-[12px] font-medium transition-colors duration-200 lg:text-[13px] ${active ? "text-violet-200" : "text-white/75 hover:text-white"}`}>
                {item.label}
                <span className={`absolute inset-x-0 -bottom-1 h-px bg-linear-to-r from-[#b83cff] to-[#5d4cff] transition-transform duration-200 ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3 lg:gap-4">
          <ThemeToggle />
          <Link href="/login" className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-linear-to-r from-[#8b3dff] to-[#5d4cff] px-4 text-[12px] font-semibold text-white shadow-[0_8px_30px_rgba(105,65,255,0.28)] transition duration-200 hover:-translate-y-px hover:shadow-[0_10px_35px_rgba(105,65,255,0.4)] lg:h-11 lg:gap-2.5 lg:px-5 lg:text-[13px]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0"><path d="M6.2 9.4L12 5l5.8 4.4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.5 13.2c.8 3.2 3.2 5.3 6.5 5.3s5.7-2.1 6.5-5.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            <span className="hidden lg:inline">Continue with ClickUp</span>
            <span className="lg:hidden">Login</span>
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Nav;
