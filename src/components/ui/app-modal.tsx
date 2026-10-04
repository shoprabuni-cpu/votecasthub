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
    <div className="app-modal-actions">{cancelLabel && <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>}{onConfirm && <button type="button" className={tone === "danger" ? "danger-button" : "primary-link"} disabled={busy} onClick={onConfirm}>{confirmLabel}</button>}</div>
  </dialog>;
}
