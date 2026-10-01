"use client";

import { useActionState } from "react";
import { setEventStatusAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function EventStatusForm({ eventId, action, backTo, label, confirmMessage }: { eventId: string; action: "publish" | "pause" | "resume" | "close" | "archive"; backTo: string; label: string; confirmMessage?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(setEventStatusAction, null);
  return <form action={formAction} onSubmit={(event) => { if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault(); }}>
    <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="action" value={action} /><input type="hidden" name="backTo" value={backTo} />
    {state?.message && <p className="form-message" role="alert">{state.message}</p>}
    <button type="submit" className={action === "publish" ? "primary-link" : "secondary-button"} disabled={pending}>{pending ? "Updating…" : label}</button>
  </form>;
}
