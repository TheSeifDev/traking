"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "trackup-theme";

type ThemeMode = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const nextTheme: ThemeMode = stored === "light" ? "light" : "dark";
    document.documentElement.dataset.trackupTheme = nextTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.trackupTheme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
  };

  const isLight = theme === "light";
  const Icon = isLight ? Sun : Moon;

  return (
    <button
      type="button"
      aria-label={isLight ? "Use dark theme" : "Use light theme"}
      aria-pressed={isLight}
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition duration-200 hover:border-violet-300/35 hover:bg-violet-500/10 hover:text-white active:scale-95"
    >
      <Icon size={16} />
    </button>
  );
}
