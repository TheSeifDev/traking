"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const navItems = [
  { label: "Features", href: "features" },
  { label: "How It Works", href: "how-it-works" },
  { label: "Integrations", href: "integrations" },
  { label: "Use Cases", href: "use-cases" },
  { label: "FAQ", href: "faq" },
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
            width={205}
            height={58}
            priority
            className="h-8 w-auto lg:h-9"
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

          {/* ClickUp CTA */}
          <Link
            href="/login"
            className="
              flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 
              bg-linear-to-r from-[#8b3dff] to-[#5d4cff] 
              text-[13px] font-semibold text-white 
              shadow-[0_8px_30px_rgba(105,65,255,0.28)] transition-all duration-200 
              hover:-translate-y-px hover:shadow-[0_10px_35px_rgba(105,65,255,0.4)]
              lg:h-11 lg:gap-2.5 lg:px-6 lg:text-[14px]
            "
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <path
                d="M6.2 9.4L12 5l5.8 4.4"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 13.2c.8 3.2 3.2 5.3 6.5 5.3s5.7-2.1 6.5-5.3"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden lg:inline">Continue with ClickUp</span>
            <span className="lg:hidden">Login</span>
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Nav;