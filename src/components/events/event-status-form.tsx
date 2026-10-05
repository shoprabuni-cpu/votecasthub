"use client";

import { useActionState, useRef, useState } from "react";
import { setEventStatusAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AppModal } from "@/components/ui/app-modal";

export function EventStatusForm({ eventId, action, backTo, label, confirmMessage, disabled = false, disabledMessage }: { eventId: string; action: "publish" | "pause" | "resume" | "close" | "archive" | "unpublish"; backTo: string; label: string; confirmMessage?: string; disabled?: boolean; disabledMessage?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(setEventStatusAction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const approved = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  return <><form ref={formRef} action={formAction} onSubmit={(event) => { if (confirmMessage && !approved.current) { event.preventDefault(); setConfirmOpen(true); } else { approved.current = false; } }}>
    <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="action" value={action} /><input type="hidden" name="backTo" value={backTo} />
    {state?.message && <p className="form-message" role="alert">{state.message}</p>}
    <button type="submit" className={action === "publish" ? "primary-link" : "secondary-button"} disabled={pending || disabled}>{pending ? "Submitting…" : action === "publish" ? "Submit for review" : label}</button>
    {disabled && disabledMessage && <small className="publish-disabled-note">{disabledMessage}</small>}
  </form><AppModal open={confirmOpen} title={label} message={confirmMessage ?? "Are you sure you want to continue?"} tone={action === "close" || action === "archive" ? "danger" : "info"} confirmLabel={label} onCancel={() => setConfirmOpen(false)} onConfirm={() => { approved.current = true; setConfirmOpen(false); formRef.current?.requestSubmit(); }} /></>;
}
