"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Props = { organizationId: string; organizationName: string; role: string };

function NavIcon({ name }: { name: "grid" | "plus" | "users" | "building" | "external" | "wallet" | "sms" | "chart" }) {
  const paths = {
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 14h2"/></>,
    sms: <><path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 4V5a2 2 0 0 1 2-2Z"/><path d="M7 8h10M7 12h6"/></>,
    chart: <><path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    building: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M9 21v-4h6v4M8 8h1m6 0h1m-8 4h1m6 0h1"/></>,
    external: <><path d="M14 3h7v7M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      {paths[name]}
    </svg>
  );
}

export function WorkspaceSidebar({ organizationId, organizationName, role }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const root = `/organizer/${organizationId}`;
  const events = `${root}/events`;
  const canCreate = ["owner", "admin", "editor"].includes(role);
  const canManageTeam = ["owner", "admin"].includes(role);

  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const overviewActive =
    pathname === events || (pathname.startsWith(`${events}/`) && pathname !== `${events}/new`);

  const navLinks = [
    { label: "Overview", href: events, icon: "grid" as const, isActive: overviewActive },
    ...(canCreate ? [{ label: "Create event", href: `${events}/new`, icon: "plus" as const, isActive: active(`${events}/new`, true) }] : []),
    { label: "Analytics", href: `${root}/analytics`, icon: "chart" as const, isActive: active(`${root}/analytics`) },
    { label: "Payments & Payouts", href: `${root}/payments`, icon: "wallet" as const, isActive: active(`${root}/payments`) || active(`${root}/earnings`) },
    { label: "SMS Credits", href: `${root}/credits`, icon: "sms" as const, isActive: active(`${root}/credits`) },
    ...(canManageTeam ? [{ label: "Team access", href: `${root}/team`, icon: "users" as const, isActive: active(`${root}/team`, true) }] : []),
  ];

  return (
    <>
      {/* Mobile Top Bar Bar / Hamburger */}
      <div className="flex md:hidden items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <Link href="/organizer" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 font-bold text-white text-sm shadow-xs">
            V
          </div>
          <div>
            <div className="text-xs font-bold text-stone-900 leading-none">VotecastHub</div>
            <div className="text-[10px] text-emerald-700 font-mono tracking-wider font-semibold">STUDIO</div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-600 hover:text-stone-900 shadow-2xs"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-stone-200 bg-white p-4 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 pt-2">
            <Link href="/organizer" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
                V
              </div>
              <div>
                <div className="text-sm font-bold text-stone-900 tracking-tight">VotecastHub</div>
                <div className="text-[10px] font-bold text-emerald-800 font-mono tracking-wider">
                  ORGANIZER STUDIO
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="text-stone-400 hover:text-stone-700 md:hidden"
            >
              ✕
            </button>
          </div>

          {/* Organization Switcher Pill */}
          <Link
            href="/organizer"
            className="group flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-3 transition-all hover:border-emerald-600/30 hover:bg-emerald-50/20"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-200/80 text-stone-700">
                <NavIcon name="building" />
              </div>
              <div className="truncate">
                <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                  WORKING IN
                </div>
                <div className="text-xs font-bold text-stone-900 truncate group-hover:text-emerald-800 transition-colors">
                  {organizationName}
                </div>
              </div>
            </div>
            <span className="text-xs text-stone-400 group-hover:text-stone-600 transition-colors">⌄</span>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1" aria-label="Workspace navigation">
            <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
              WORKSPACE
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  link.isActive
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <NavIcon name={link.icon} />
                <span>{link.label}</span>
                {link.isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-600" />
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom User/Org Profile Badge */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
            {organizationName.trim().slice(0, 1).toUpperCase()}
          </div>
          <div className="truncate flex-1">
            <div className="text-xs font-semibold text-stone-900 truncate">{organizationName}</div>
            <div className="text-[10px] text-stone-500 capitalize font-medium">{role} access</div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-600" title="Protected workspace" />
        </div>
      </aside>
    </>
  );
}
