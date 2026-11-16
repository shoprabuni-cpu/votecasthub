"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getCurrentTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("vch-theme");
  if (stored === "dark" || stored === "light") return stored;
  return getSystemTheme();
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  if (theme === "dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
    if (metaTheme) metaTheme.setAttribute("content", "#000000");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
    if (metaTheme) metaTheme.setAttribute("content", "#fafbf8");
  }

  try {
    localStorage.setItem("vch-theme", theme);
  } catch {}

  window.dispatchEvent(new CustomEvent("vch-theme-change", { detail: { theme } }));
}

/**
 * Compact Icon Theme Toggle (ideal for header bars)
 */
export function ThemeToggle({
  className = "",
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const active = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(active);

    const onThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail?.theme) {
        setTheme(customEvent.detail.theme);
      }
    };

    window.addEventListener("vch-theme-change", onThemeChange);
    return () => window.removeEventListener("vch-theme-change", onThemeChange);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark (deep black) theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark (deep black) theme"}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-stone-200/90 bg-white/90 p-2 text-stone-700 shadow-2xs transition-all hover:border-emerald-600 hover:bg-stone-50 hover:text-emerald-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-[#1f2c24] dark:bg-[#0a0d0b] dark:text-stone-300 dark:hover:border-emerald-500/80 dark:hover:bg-[#121814] dark:hover:text-emerald-400 cursor-pointer ${className}`}
    >
      {/* Sun Icon (shown in dark mode to switch to light) */}
      <svg
        className={`size-4.5 transition-transform duration-300 ${
          isDark ? "rotate-0 scale-100 text-amber-400" : "-rotate-90 scale-0 hidden"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
        />
      </svg>

      {/* Moon Icon (shown in light mode to switch to dark) */}
      <svg
        className={`size-4.5 transition-transform duration-300 ${
          !isDark ? "rotate-0 scale-100 text-stone-700" : "rotate-90 scale-0 hidden"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
        />
      </svg>

      {showLabel && (
        <span className="text-xs font-semibold">
          {mounted ? (isDark ? "Light mode" : "Deep black") : "Theme"}
        </span>
      )}
    </button>
  );
}

/**
 * Segmented Theme Switcher (ideal for drawers, modals, footers)
 */
export function SegmentedThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const active = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(active);

    const onThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail?.theme) {
        setTheme(customEvent.detail.theme);
      }
    };

    window.addEventListener("vch-theme-change", onThemeChange);
    return () => window.removeEventListener("vch-theme-change", onThemeChange);
  }, []);

  const select = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const isDark = mounted ? theme === "dark" : false;

  return (
    <div
      role="radiogroup"
      aria-label="Color theme selection"
      className={`inline-flex items-center rounded-xl border border-stone-200/90 bg-stone-100/90 p-1 text-xs font-semibold dark:border-[#1f2c24] dark:bg-[#070a08] ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isDark}
        onClick={() => select("light")}
        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition-all cursor-pointer ${
          !isDark
            ? "bg-white text-stone-900 shadow-2xs border border-stone-200/80 font-bold"
            : "text-stone-400 hover:text-stone-200 hover:bg-[#121914]"
        }`}
      >
        <svg className="size-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
        <span>Light</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        onClick={() => select("dark")}
        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition-all cursor-pointer ${
          isDark
            ? "bg-[#14261b] text-emerald-200 shadow-2xs border border-emerald-600/50 font-bold"
            : "text-stone-600 hover:text-stone-900 hover:bg-white/60"
        }`}
      >
        <svg className="size-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
        <span>Deep Black</span>
      </button>
    </div>
  );
}
