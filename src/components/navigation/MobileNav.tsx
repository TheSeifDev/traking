"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
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

const MobileNav = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 md:hidden ${open || scrolled ? "border-white/6 bg-[#050617]/80 backdrop-blur-xl" : "border-transparent bg-transparent"}`}>
      <nav className="relative z-50 flex h-16 items-center justify-between px-5">
        <Link href="/" onClick={() => setOpen(false)} aria-label="TrackUp home" className="flex items-center gap-2"><Image src="/logo.webp" alt="TrackUp" width={128} height={128} priority className="h-7 w-7 object-contain" /><span className="text-base font-semibold tracking-[-0.04em] text-white">TrackUp</span></Link>
        <div className="flex items-center gap-2"><ThemeToggle /><button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((previous) => !previous)} className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-white/2.5 text-white transition duration-200 hover:bg-white/6 active:scale-95"><Menu size={21} className={`absolute transition-all duration-200 ${open ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`} /><X size={21} className={`absolute transition-all duration-200 ${open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`} /></button></div>
      </nav>
      <div onClick={() => setOpen(false)} aria-hidden="true" className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <div id="mobile-menu" role="dialog" aria-modal="true" className={`fixed inset-x-4 top-20 z-40 overflow-hidden rounded-2xl border border-white/8 bg-[#0b0b28]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-300 ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-3 opacity-0"}`}>
        <div className="flex flex-col p-3">
          {navItems.map((item, index) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.label} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} style={{ transitionDelay: open ? `${index * 40}ms` : "0ms" }} className={`rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-300 ${active ? "bg-violet-500/12 text-violet-200" : "text-white/80 hover:bg-white/5 hover:text-white"} ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}>{item.label}</Link>;
          })}
          <Link href="/login" onClick={() => setOpen(false)} style={{ transitionDelay: open ? `${navItems.length * 40}ms` : "0ms" }} className={`mt-2 flex h-11 items-center justify-center rounded-xl bg-linear-to-r from-[#8b3dff] to-[#5d4cff] text-sm font-semibold text-white shadow-[0_8px_25px_rgba(105,65,255,0.25)] transition-all duration-300 ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}>Continue with ClickUp</Link>
        </div>
      </div>
    </header>
  );
};

export default MobileNav;
