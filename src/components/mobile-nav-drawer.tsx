"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const links = [
  ["/events", "Browse events"],
  ["/guides", "Guides"],
  ["/pricing", "Pricing"],
  ["/about", "About"],
  ["/sign-in", "Organizer sign in"],
] as const;

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
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
      <div className={`ml-auto flex h-full w-[min(22rem,calc(100vw-1rem))] flex-col border-l border-stone-200 bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">VotecastHub GH</p>
            <h2 id="mobile-menu-title" className="mt-1 text-lg font-semibold">Menu</h2>
          </div>
          <button type="button" aria-label="Close navigation menu" onClick={close} className="inline-flex size-11 items-center justify-center rounded-xl text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav aria-label="Mobile navigation" className="flex-1 space-y-1 overflow-y-auto p-4">
          {links.map(([href, label]) => <Link key={href} href={href} onClick={close} className="flex min-h-12 items-center rounded-xl px-4 text-base font-medium text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-700">{label}</Link>)}
        </nav>
        <div className="border-t border-stone-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link href="/sign-up" onClick={close} className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white! shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Get started</Link>
        </div>
      </div>
    </dialog>
  </>;
}
