"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
export function AppModal({ open, title, message, tone = "info", confirmLabel = "Continue", cancelLabel = "Cancel", onConfirm, onCancel, children, busy = false }: {
  open: boolean; title: string; message: string; tone?: "info" | "success" | "danger";
  confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; onCancel: () => void; children?: ReactNode; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  return <dialog ref={dialog} className={`app-modal app-modal-${tone}`} aria-labelledby={id} aria-describedby={id+"-message"} onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}>
    <div className="app-modal-icon" aria-hidden="true">{tone === "danger" ? "!" : tone === "success" ? "✓" : "i"}</div>
    <div className="app-modal-copy"><h2 id={id}>{title}</h2><p id={id+"-message"}>{message}</p></div>
    {children && <div className="app-modal-content">{children}</div>}
    <div className="app-modal-actions">{cancelLabel && <button type="button" className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy} onClick={onCancel}>{cancelLabel}</button>}{onConfirm && <button type="button" className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${tone === "danger" ? "bg-red-700 hover:bg-red-800" : "bg-emerald-900 hover:bg-emerald-800"}`} disabled={busy} onClick={onConfirm}>{confirmLabel}</button>}</div>
  </dialog>;
}
