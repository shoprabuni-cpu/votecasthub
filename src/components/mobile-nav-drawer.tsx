"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { useEffect, useRef, useState } from "react";

const links = [
  ["/events", "Browse events", "vote"],
  ["/guides", "Guides", "mail"],
  ["/pricing", "Pricing", "coin"],
  ["/about", "About", "building"],
  ["/sign-in", "Organizer sign in", "users"],
] as const;

export function MobileNavDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dialog.firstElementChild?.animate?.([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], { duration: 260, easing: "ease-out" });
      }
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    setOpen(false);
  }

  return <>
    <button
      type="button"
      aria-label="Open navigation menu"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-800 shadow-sm transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 lg:hidden"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
    <dialog
      ref={dialogRef}
      aria-labelledby="mobile-menu-title"
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === dialogRef.current) close(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-stone-900 backdrop:bg-stone-950/45"
    >
      <div className={`mr-auto flex h-full w-[min(22rem,calc(100vw-1rem))] flex-col rounded-r-3xl border-r border-stone-200 bg-stone-50 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-emerald-800 bg-emerald-950 px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white rounded-tr-3xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">VotecastHub GH</p>
            <h2 id="mobile-menu-title" className="mt-2 text-2xl font-semibold">Explore & vote</h2>
          </div>
          <button type="button" aria-label="Close navigation menu" onClick={close} className="inline-flex size-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav aria-label="Mobile navigation" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Discover VotecastHub</p>
          {links.map(([href, label, icon]) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return <Link key={href} href={href} onClick={close} aria-current={active ? "page" : undefined} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${active ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-white text-stone-700 hover:border-emerald-200 hover:bg-emerald-50"}`}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100/70 text-emerald-800"><Icon name={icon} /></span>{label}<Icon name="arrowRight" size={16} className="ml-auto text-stone-400" />
            </Link>;
          })}
        </nav>
        <div className="border-t border-stone-200 bg-white p-5 rounded-br-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 text-sm text-stone-600">Ready to create your own event?</p>
          <Link href="/sign-up" onClick={close} className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white! shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Get started</Link>
        </div>
      </div>
    </dialog>
  </>;
}
