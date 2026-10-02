"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Props = { organizationId: string; organizationName: string; role: string };

function NavIcon({ name }: { name: "grid" | "plus" | "users" | "building" | "external" }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    building: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M9 21v-4h6v4M8 8h1m6 0h1m-8 4h1m6 0h1"/></>,
    external: <><path d="M14 3h7v7M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function WorkspaceSidebar({ organizationId, organizationName, role }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = `/organizer/${organizationId}`;
  const events = `${root}/events`;
  const canCreate = ["owner", "admin", "editor"].includes(role);
  const canManageTeam = ["owner", "admin"].includes(role);
  const active = (href: string, exact = false) => exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const overviewActive = pathname === events || (pathname.startsWith(`${events}/`) && pathname !== `${events}/new`);

  return <aside className={`workspace-sidebar ${open ? "is-open" : ""}`}>
    <div className="workspace-sidebar-head">
      <Link href="/organizer" className="workspace-brand" aria-label="VotecastHub organizations"><span className="brand-mark">V</span><span>VotecastHub<small>ORGANIZER STUDIO</small></span></Link>
      <button className="workspace-menu-toggle" type="button" aria-label={open ? "Close workspace menu" : "Open workspace menu"} aria-expanded={open} onClick={() => setOpen(value => !value)}><span/><span/><span/></button>
    </div>
    <Link href="/organizer" className="workspace-switcher"><span className="workspace-switcher-icon"><NavIcon name="building"/></span><span><small>WORKING IN</small><strong>{organizationName}</strong></span><span className="workspace-switcher-chevron">⌄</span></Link>
    <nav className="workspace-sidebar-nav" aria-label="Organization workspace">
      <span className="workspace-nav-label">WORKSPACE</span>
      <Link className={`workspace-nav-link ${overviewActive ? "is-active" : ""}`} href={events} aria-current={pathname === events ? "page" : undefined}><NavIcon name="grid"/><span>Overview</span>{pathname === events && <i aria-hidden="true"/>}</Link>
      {canCreate && <Link className={`workspace-nav-link ${active(`${events}/new`, true) ? "is-active" : ""}`} href={`${events}/new`} aria-current={active(`${events}/new`, true) ? "page" : undefined}><NavIcon name="plus"/><span>Create event</span></Link>}
      {canManageTeam && <Link className={`workspace-nav-link ${active(`${root}/team`, true) ? "is-active" : ""}`} href={`${root}/team`} aria-current={active(`${root}/team`, true) ? "page" : undefined}><NavIcon name="users"/><span>Team &amp; access</span></Link>}
      <span className="workspace-nav-label workspace-nav-label-spaced">DISCOVER</span>
      <Link className="workspace-nav-link" href="/events"><NavIcon name="external"/><span>Public events</span><span className="workspace-external">↗</span></Link>
    </nav>
    <div className="workspace-sidebar-bottom"><span className="workspace-avatar" aria-hidden="true">{organizationName.trim().slice(0, 1).toUpperCase()}</span><span className="workspace-bottom-copy"><strong>{organizationName}</strong><small>{role} workspace access</small></span><span className="workspace-secure" title="Protected workspace">●</span></div>
  </aside>;
}
