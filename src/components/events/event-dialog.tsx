"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/** Native modal supplies focus trapping, Escape handling and an inert background. */
export function EventDialog({ open, title, children, onClose, busy = false }: {
  open: boolean; title: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open, mounted]);
  if (!mounted) return null;
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} onSubmit={event => event.stopPropagation()} onChange={event => event.stopPropagation()} onInput={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-stone-900 shadow-xl backdrop:bg-stone-950/40 sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog" className="min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50 border border-stone-300 bg-white shadow-xs py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed">Close</button></div>
    {children}
  </dialog>, document.body);
}
