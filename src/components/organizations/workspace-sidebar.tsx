"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SegmentedThemeSwitch } from "@/components/theme-toggle";
import { CreateEventModal } from "@/components/events/create-event-modal";
import { LineSidebar, type LineSidebarItem } from "@/components/ui/LineSidebar";

type Props = { organizationId: string; organizationName: string; role: string; mobile?: boolean; onNavigate?: () => void };

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

export function WorkspaceSidebar({ organizationId, organizationName, role, mobile = false, onNavigate }: Props) {
  const pathname = usePathname();

  const root = `/organizer/${organizationId}`;
  const events = `${root}/events`;
  const canCreate = ["owner", "admin", "editor"].includes(role);
  const canManageTeam = ["owner", "admin"].includes(role);

  const active = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const overviewActive =
    pathname === events || (pathname.startsWith(`${events}/`) && pathname !== `${events}/new`);

  const navLinks = [
    { label: "Your events", href: events, icon: "grid" as const, isActive: overviewActive },
    ...(canCreate ? [{ label: "Create event", href: `${events}/new`, icon: "plus" as const, isActive: active(`${events}/new`, true) }] : []),
    { label: "Reports & Standings", href: `${root}/analytics`, icon: "chart" as const, isActive: active(`${root}/analytics`), badge: "LIVE" },
    { label: "Payments & Payouts", href: `${root}/payments`, icon: "wallet" as const, isActive: active(`${root}/payments`) || active(`${root}/earnings`) },
    { label: "SMS Credits", href: `${root}/credits`, icon: "sms" as const, isActive: active(`${root}/credits`) },
    ...(canManageTeam ? [{ label: "Team access", href: `${root}/team`, icon: "users" as const, isActive: active(`${root}/team`, true) }] : []),
  ];

  const sidebarItems: LineSidebarItem[] = navLinks.map((link) => {
    const isCreate = link.label === "Create event";
    return {
      id: link.href,
      label: link.label,
      href: isCreate ? undefined : link.href,
      icon: <NavIcon name={link.icon} />,
      isActive: link.isActive,
      onClick: isCreate ? undefined : onNavigate,
      badge: link.badge ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[9px] font-black text-emerald-950 uppercase tracking-wider dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
          <span>{link.badge}</span>
        </span>
      ) : link.isActive ? (
        <span className="size-1.5 rounded-full bg-emerald-600" />
      ) : null,
      render: isCreate
        ? ({ isActive, className, children }) => (
            <CreateEventModal
              organizationId={organizationId}
              trigger={
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                >
                  {children}
                </button>
              }
            />
          )
        : undefined,
    };
  });

  return (
    <>
      <aside
        aria-label="Organizer sidebar"
        className={
          mobile
            ? "flex min-h-0 w-full flex-1 flex-col justify-between gap-6 overflow-y-auto bg-white dark:bg-black p-4"
            : "sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between gap-6 self-start overflow-y-auto border-r border-stone-200 bg-white p-4 lg:flex dark:border-[#1c2721] dark:bg-black transition-colors"
        }
      >
        <div className="space-y-5">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 pt-2">
            <Link href="/organizer" onClick={onNavigate} className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
                V
              </div>
              <div>
                <div className="text-sm font-bold text-stone-900 dark:text-white tracking-tight">VotecastHub</div>
                <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 font-mono tracking-wider">
                  ORGANIZER STUDIO
                </div>
              </div>
            </Link>
          </div>

          {/* Organization Switcher Pill */}
          <Link
            href="/organizer"
            onClick={onNavigate}
            className="group flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-3 transition-all hover:border-emerald-600/30 hover:bg-emerald-50/20 dark:border-[#1c2721] dark:bg-[#070a08] dark:hover:bg-[#0e1410]"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-200/80 dark:bg-[#121915] text-stone-700 dark:text-stone-300">
                <NavIcon name="building" />
              </div>
              <div className="truncate">
                <div className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  WORKING IN
                </div>
                <div className="text-xs font-bold text-stone-900 dark:text-white truncate group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
                  {organizationName}
                </div>
              </div>
            </div>
            <span className="text-xs text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">⌄</span>
          </Link>

          {/* Theme Selector inside Sidebar */}
          <div className="px-1">
            <SegmentedThemeSwitch className="w-full justify-between" />
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-stone-400 dark:text-stone-500 uppercase">
              WORKSPACE
            </div>

            <LineSidebar
              items={sidebarItems}
              showIndex={false}
              showMarker={true}
              markerLength={24}
              markerGap={8}
              maxShift={12}
              proximityRadius={70}
              itemGap={6}
              fontSize={0.875}
              className="w-full px-2"
            />
          </div>
        </div>

        {/* Bottom Actions & User Profile */}
        <div className="space-y-3">
          {/* Mobile Money Status Pill */}
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/60 p-2.5 flex items-center justify-between text-xs dark:border-emerald-900/60 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="font-semibold text-emerald-950 dark:text-emerald-300 text-[11px]">Paystack MoMo Active</span>
            </div>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-mono font-bold">🇬🇭 GHS</span>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
            <Link
              href="/events"
              target="_blank"
              className="rounded-lg border border-stone-200 bg-stone-50/80 p-2 text-stone-700 hover:bg-stone-100 hover:text-stone-900 text-center transition-colors dark:border-[#1c2721] dark:bg-[#070a08] dark:text-stone-300 dark:hover:bg-[#0e1410] dark:hover:text-white"
            >
              Public Site ↗
            </Link>
            <a
              href="https://wa.me/233592992566?text=VOTE"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900 hover:bg-emerald-100 text-center transition-colors dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/80"
            >
              Test Bot ↗
            </a>
          </div>

          {/* User/Org Profile Badge */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex items-center gap-3 dark:border-[#1c2721] dark:bg-[#070a08]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
              {organizationName.trim().slice(0, 1).toUpperCase()}
            </div>
            <div className="truncate flex-1">
              <div className="text-xs font-semibold text-stone-900 dark:text-white truncate">{organizationName}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 capitalize font-medium">{role} access</div>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-600" title="Protected workspace" />
          </div>
        </div>
      </aside>
    </>
  );
}
