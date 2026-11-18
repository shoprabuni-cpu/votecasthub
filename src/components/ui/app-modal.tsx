"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function AppModal({
  open,
  title,
  message,
  tone = "info",
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  children,
  busy = false,
}: {
  open: boolean;
  title: string;
  message: string;
  tone?: "info" | "success" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  children?: ReactNode;
  busy?: boolean;
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
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="fixed inset-0 m-auto w-[min(92vw,30rem)] max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 text-stone-900 shadow-2xl backdrop:bg-stone-950/60 backdrop:backdrop-blur-xs dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-100 open:grid open:grid-cols-[auto_1fr] open:gap-4"
      aria-labelledby={id}
      aria-describedby={id + "-message"}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white ${
          tone === "danger" ? "bg-rose-600" : tone === "success" ? "bg-emerald-600" : "bg-emerald-800"
        }`}
        aria-hidden="true"
      >
        {tone === "danger" ? "!" : tone === "success" ? "✓" : "i"}
      </div>
      <div className="min-w-0">
        <h2 id={id} className="font-serif text-lg font-medium text-stone-900 dark:text-white">{title}</h2>
        <p id={id + "-message"} className="mt-1 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">{message}</p>
      </div>
      {children && <div className="col-span-full min-w-0 mt-2">{children}</div>}
      <div className="col-span-full mt-4 flex items-center justify-end gap-3">
        {cancelLabel && (
          <button
            type="button"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-800 shadow-xs hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        )}
        {onConfirm && (
          <button
            type="button"
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${
              tone === "danger" ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-900 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            }`}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </dialog>
  );
}
