"use client";

import { useActionState, useRef, useState } from "react";
import { deleteUnusedEventAction } from "@/lib/events/actions";
import { AppModal } from "@/components/ui/app-modal";

export function DeleteEventForm({ eventId, name }: { eventId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteUnusedEventAction, null);
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const approved = useRef(false);

  return (
    <>
      <form
        ref={form}
        action={action}
        onSubmit={(e) => {
          if (!approved.current) {
            e.preventDefault();
            setOpen(true);
          } else {
            approved.current = false;
          }
        }}
      >
        <input type="hidden" name="eventId" value={eventId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 shadow-2xs hover:bg-red-50 hover:border-red-300 disabled:opacity-60 transition-all cursor-pointer"
        >
          {pending ? "Deleting..." : "Delete unused draft"}
        </button>
        {state?.message && (
          <p className="mt-1 text-xs text-red-700 font-medium" role="alert">
            {state.message}
          </p>
        )}
      </form>

      <AppModal
        open={open}
        tone="danger"
        title="Permanently delete this event?"
        message={`“${name}”, its categories, nominees, and uploaded artwork will be removed permanently. This action cannot be undone.`}
        confirmLabel="Delete event permanently"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          approved.current = true;
          setOpen(false);
          form.current?.requestSubmit();
        }}
      />
    </>
  );
}
