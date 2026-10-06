"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

export function MobileTabBar() {
  return (
    <nav
      aria-label="Mobile quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-4 py-2 sm:hidden flex items-center justify-around shadow-[0_-8px_20px_rgba(0,0,0,0.04)]"
    >
      <Link
        href="/events"
        className="flex flex-col items-center gap-1 py-1 px-3 text-slate-600 hover:text-emerald-800 active:scale-95 transition-all text-center"
      >
        <Icon name="trophy" size={20} className="text-emerald-800" />
        <span className="text-[10px] font-semibold">Events</span>
      </Link>

      <a
        href="#how-it-works"
        className="flex flex-col items-center gap-1 py-1 px-3 text-slate-600 hover:text-emerald-800 active:scale-95 transition-all text-center"
      >
        <Icon name="shield" size={20} className="text-slate-600" />
        <span className="text-[10px] font-semibold">How It Works</span>
      </a>

      <Link
        href="/sign-in"
        className="flex flex-col items-center gap-1 py-1 px-3 text-slate-600 hover:text-emerald-800 active:scale-95 transition-all text-center"
      >
        <Icon name="users" size={20} className="text-slate-600" />
        <span className="text-[10px] font-semibold">Sign In</span>
      </Link>

      <Link
        href="/sign-up"
        className="flex flex-col items-center gap-1 py-1 px-3.5 bg-emerald-800 text-white rounded-xl shadow-xs active:scale-95 transition-all text-center"
      >
        <Icon name="sparkle" size={18} className="text-amber-300" />
        <span className="text-[10px] font-bold">Host</span>
      </Link>
    </nav>
  );
}
