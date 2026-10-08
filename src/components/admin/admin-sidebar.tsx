"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";

interface NavItem {
  name: string;
  href: string;
  icon: "sparkle" | "vote" | "shield" | "building" | "coin";
  badge?: string;
}

const navItems: NavItem[] = [
  { name: "Review Queue", href: "/admin", icon: "sparkle" },
  { name: "Events", href: "/admin/events", icon: "vote" },
  { name: "Moderation", href: "/admin/moderation", icon: "shield" },
  { name: "Organizers", href: "/admin/organizers", icon: "building" },
  { name: "Payments", href: "/admin/payments", icon: "coin" },
  { name: "Data deletion", href: "/admin/deletions", icon: "shield" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between p-4 sm:p-5">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900 text-white font-serif font-bold text-base shadow-xs">
              V
            </span>
            <div>
              <span className="font-serif font-bold text-stone-900 text-sm tracking-tight block leading-tight">
                VoteHub GH
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                Platform Admin
              </span>
            </div>
          </Link>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <Icon name={item.icon} size={16} />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      active ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Switcher */}
      <div className="pt-4 border-t border-stone-100 space-y-2">
        <Link
          href="/organizer"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <Icon name="arrowLeft" size={14} />
          <span>Organizer workspace</span>
        </Link>
        <div className="px-3 py-1.5 text-[10px] text-stone-400">
          Super Admin Console · v2.1
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-900 text-white font-serif font-bold text-xs">
            V
          </span>
          <span className="font-serif font-bold text-stone-900 text-sm">Admin Console</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
        >
          <Icon name="sparkle" size={15} />
        </button>
      </header>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-white shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-stone-200/90 bg-white shadow-2xs">
        {navContent}
      </aside>
    </>
  );
}
