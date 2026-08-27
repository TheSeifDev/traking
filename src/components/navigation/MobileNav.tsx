"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navItems = [
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Integrations", href: "/integrations" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "FAQ", href: "/faq" },
];

const MobileNav = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 md:hidden ${open || scrolled ? "border-b border-white/8 bg-[#0b0b28]/92 backdrop-blur-xl" : "border-b border-white/8 bg-[#0b0b28]/78 backdrop-blur-xl"}`}
    >
      <nav className="relative z-50 mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-6">
        {/* Logo */}
        <Link href="/" onClick={() => setOpen(false)} className="flex items-center">
          <Image
            src="/logo.webp"
            alt="TrackUp"
            width={128}
            height={128}
            priority
            className="h-7 w-7 object-contain"
          />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Menu */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((prev) => !prev)}
            className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-white transition-colors hover:border-white/20 hover:bg-white/[0.08]"
          >
            <Menu
              size={21}
              className={`absolute transition-all duration-200 ${
                open ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
              }`}
            />
            <X
              size={21}
              className={`absolute transition-all duration-200 ${
                open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`
          fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300
          ${open ? "opacity-100" : "pointer-events-none opacity-0"}
        `}
      />

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        className={`
          fixed inset-x-4 top-20 z-40 overflow-hidden rounded-2xl border border-white/9 bg-[#0b0b28]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl
          transition-all duration-300
          ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-3 opacity-0"}
        `}
      >
        <div className="flex flex-col p-3">
          {navItems.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
              className={`rounded-xl px-4 py-3.5 text-sm font-medium text-white/65 transition-all duration-300 hover:bg-white/5 hover:text-white ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/login"
            onClick={() => setOpen(false)}
            style={{ transitionDelay: open ? `${navItems.length * 40}ms` : "0ms" }}
            className={`mt-2 flex h-11 items-center justify-center rounded-xl bg-violet-500 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(124,58,237,0.28)] transition-all duration-300 hover:bg-violet-400 ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
          >
            Continue with ClickUp
          </Link>
        </div>
      </div>
    </header>
  );
};

export default MobileNav;