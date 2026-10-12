"use client";

import { createContext, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SignOutForm } from "@/components/auth/sign-out-form";
import { Icon } from "@/components/icon";

export const WorkspaceShellContext = createContext(false);
type Props = {
  organizationId: string;
  organizationName: string;
  role: string;
  notifications: Parameters<typeof NotificationBell>[0]["notifications"];
  children: ReactNode;
};

export function WorkspaceShell({ children, notifications, ...workspace }: Props) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const root = `/organizer/${workspace.organizationId}`;
  const section = pathname.slice(root.length).split("/").filter(Boolean);
  const titles: Record<string, string> = { events: "Your events", analytics: "Analytics", payments: "Payments", earnings: "Earnings", credits: "SMS credits", team: "Team" };
  const title = section[0] === "events" && section[1]
    ? section[1] === "new" ? "Create event" : section[2] === "preview" ? "Event preview" : "Manage event"
    : titles[section[0]] ?? "Your workspace";

  function openNavigation() {
    dialog.current?.showModal();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.current?.firstElementChild?.animate?.([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], { duration: 220, easing: "ease-out" });
    }
  }
  function closeNavigation() { dialog.current?.close(); }
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  return <WorkspaceShellContext.Provider value={true}>
    <div className="flex min-h-dvh bg-stone-50 text-stone-900">
      <WorkspaceSidebar {...workspace} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Open workspace navigation" aria-haspopup="dialog" onClick={openNavigation} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-700 lg:hidden">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="min-w-0"><Link href="/organizer" className="block truncate text-xs font-medium text-stone-500 hover:text-emerald-800">{workspace.organizationName}</Link><p className="truncate text-base font-semibold sm:text-lg">{title}</p></div>
          </div>
          <nav aria-label="Workspace actions" className="flex shrink-0 items-center gap-2">
            <Link href="/events" className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700 sm:inline-flex"><Icon name="eye" />Public site</Link>
            <NotificationBell notifications={notifications} organizationId={workspace.organizationId} compact />
            <details ref={account} className="relative" onKeyDown={event => { if (event.key === "Escape" && account.current) { account.current.open = false; account.current.querySelector("summary")?.focus(); } }}>
              <summary aria-label="Account menu" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden"><Icon name="users" /></summary>
              <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
                <p className="truncate px-3 py-2 text-sm font-semibold">{workspace.organizationName}<span className="mt-1 block text-xs font-normal capitalize text-stone-500">{workspace.role} access</span></p>
                <Link href="/organizer" className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-stone-50" onClick={() => { if (account.current) account.current.open = false; }}>Switch organizer</Link>
                <Link href="/events" className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-stone-50">View public site</Link>
                <div className="mt-2 border-t border-stone-100 pt-2"><SignOutForm compact /></div>
              </div>
            </details>
          </nav>
        </header>
        {children}
      </div>
      <dialog ref={dialog} aria-labelledby="workspace-menu-title" onClick={event => { if (event.target === dialog.current) closeNavigation(); }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-stone-950/40">
        <div className="flex h-full w-[min(20rem,calc(100vw-2rem))] flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3"><h2 id="workspace-menu-title" className="text-sm font-semibold">Your workspace</h2><button type="button" aria-label="Close workspace navigation" onClick={closeNavigation} className="flex size-11 items-center justify-center rounded-xl hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700"><Icon name="close" /></button></div>
          <WorkspaceSidebar {...workspace} mobile onNavigate={closeNavigation} />
        </div>
      </dialog>
    </div>
  </WorkspaceShellContext.Provider>;
}
