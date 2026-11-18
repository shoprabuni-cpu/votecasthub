"use client";

import { useActionState, useRef, useState } from "react";
import { setEventStatusAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { EventDialog } from "./event-dialog";
import { Icon } from "@/components/icon";

export function EventStatusForm({
  eventId,
  action,
  backTo,
  label,
  confirmMessage,
  disabled = false,
  disabledMessage,
}: {
  eventId: string;
  action: "publish" | "pause" | "resume" | "close" | "archive" | "unpublish";
  backTo: string;
  label: string;
  confirmMessage?: string;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(setEventStatusAction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const approved = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isPublish = action === "publish";
  const isDanger = action === "close" || action === "archive";

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(event) => {
          if (confirmMessage && !approved.current) {
            event.preventDefault();
            setConfirmOpen(true);
          } else {
            approved.current = false;
          }
        }}
        className="flex flex-col items-start gap-1"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="backTo" value={backTo} />

        {state?.message && (
          <p
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
              state.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
            }`}
            role="alert"
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || disabled}
          className={`min-h-11 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
            disabled
              ? "bg-stone-200 text-stone-500 cursor-not-allowed dark:bg-stone-800 dark:text-stone-400 border border-stone-300 dark:border-stone-700"
              : isPublish
              ? "bg-emerald-800 text-white shadow-xs hover:bg-emerald-700 cursor-pointer active:scale-95"
              : isDanger
              ? "border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300 cursor-pointer"
              : "border border-stone-200 bg-white text-stone-800 hover:bg-stone-50 hover:border-emerald-600 cursor-pointer"
          }`}
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              {isPublish && <Icon name="sparkle" size={14} />}
              <span>{label}</span>
            </>
          )}
        </button>

        {disabled && disabledMessage && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <span>⚠️</span>
            <span>{disabledMessage}</span>
          </div>
        )}
      </form>

      <EventDialog open={confirmOpen} title={label} onClose={() => setConfirmOpen(false)} busy={pending}>
        <p className="text-sm text-stone-600">{confirmMessage ?? "Are you sure you want to continue?"}</p>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={pending} className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${isDanger ? "bg-red-700 hover:bg-red-800" : "bg-emerald-900 hover:bg-emerald-800"}`} onClick={() => { approved.current = true; setConfirmOpen(false); formRef.current?.requestSubmit(); }}>{label}</button><button type="button" onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold bg-white shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button></div>
      </EventDialog>
    </>
  );
}
