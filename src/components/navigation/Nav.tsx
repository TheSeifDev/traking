"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const navItems = [
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Integrations", href: "/integrations" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "FAQ", href: "/faq" },
];

const Nav = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50 hidden w-full transition-all duration-300 md:block
        ${scrolled ? "border-transparent bg-transparent" : "border-transparent bg-transparent"}
      `}
    >
      <nav className="mx-auto flex h-18 w-full max-w-360 items-center px-6 lg:px-12">
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center transition-transform duration-200 hover:scale-[1.03]"
        >
          <Image
            src="/logo.webp"
            alt="TrackUp"
            width={128}
            height={128}
            priority
            className="h-8 w-8 object-contain lg:h-9 lg:w-9"
          />
        </Link>

        {/* Navigation - next to logo, left side */}
        <div className="flex items-center gap-4 pl-8 lg:gap-7 lg:pl-12 xl:gap-9 xl:pl-16">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group relative py-2 text-[13px] font-medium text-white/80 transition-colors duration-200 hover:text-white lg:text-[14px]"
            >
              {item.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-linear-to-r from-[#8b3dff] to-[#5d4cff] transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
          ))}
        </div>

        {/* Right side: theme + CTA */}
        <div className="ml-auto flex items-center gap-4 lg:gap-5">
          {/* Sign In CTA */}
          <Link
            href="/login"
            className="
              flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-5
              bg-linear-to-r from-[#8b3dff] to-[#5d4cff] 
              text-[13px] font-semibold text-white 
              shadow-[0_8px_30px_rgba(105,65,255,0.28)] transition-all duration-200 
              hover:-translate-y-px hover:shadow-[0_10px_35px_rgba(105,65,255,0.4)]
              lg:h-11 lg:px-6 lg:text-[14px]
            "
          >
            <span>Sign In</span>
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Nav;