"use client";

import { useEffect, useRef } from "react";

export function AppModal({ open, title, message, tone = "info", confirmLabel = "Continue", cancelLabel = "Cancel", onConfirm, onCancel }: { open: boolean; title: string; message: string; tone?: "info" | "success" | "danger"; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; onCancel: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) confirmRef.current?.focus(); }, [open]);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [open, onCancel]);
  if (!open) return null;
  return <div className="app-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}><section className={`app-modal app-modal-${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="app-modal-title" aria-describedby="app-modal-message"><div className="app-modal-icon" aria-hidden="true">{tone === "danger" ? "!" : tone === "success" ? "✓" : "i"}</div><div className="app-modal-copy"><h2 id="app-modal-title">{title}</h2><p id="app-modal-message">{message}</p></div><div className="app-modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>{cancelLabel}</button>{onConfirm && <button ref={confirmRef} type="button" className={tone === "danger" ? "danger-button" : "primary-link"} onClick={onConfirm}>{confirmLabel}</button>}</div></section></div>;
}
