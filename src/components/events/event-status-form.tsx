"use client";

import { useActionState, useRef, useState } from "react";
import { setEventStatusAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AppModal } from "@/components/ui/app-modal";
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
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isPublish
              ? "bg-emerald-900 text-white shadow-xs hover:bg-emerald-800"
              : isDanger
              ? "border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300"
              : "border border-stone-200 bg-white text-stone-800 hover:bg-stone-50 hover:border-emerald-600"
          }`}
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              {isPublish && <Icon name="sparkle" size={13} />}
              <span>{label}</span>
            </>
          )}
        </button>

        {disabled && disabledMessage && (
          <span className="text-[11px] text-amber-700 font-medium mt-0.5">{disabledMessage}</span>
        )}
      </form>

      <AppModal
        open={confirmOpen}
        title={label}
        message={confirmMessage ?? "Are you sure you want to continue?"}
        tone={isDanger ? "danger" : "info"}
        confirmLabel={label}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          approved.current = true;
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
