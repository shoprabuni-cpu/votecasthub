"use client";
import { useActionState, useRef, useState } from "react";
import { deleteUnusedEventAction } from "@/lib/events/actions";
import { AppModal } from "@/components/ui/app-modal";
export function DeleteEventForm({ eventId, name }: { eventId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteUnusedEventAction, null);
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const approved = useRef(false);
  return <><form ref={form} action={action} onSubmit={e=>{ if (!approved.current) { e.preventDefault(); setOpen(true); } else approved.current=false; }}>
    <input type="hidden" name="eventId" value={eventId} />
    <button className="danger-button" disabled={pending}>{pending ? "Deleting…" : "Delete unused event"}</button>
    {state?.message && <p className="form-message" role="alert">{state.message}</p>}
  </form><AppModal open={open} tone="danger" title="Permanently delete this event?" message={`“${name}”, its categories, nominees and uploaded images will be removed. This cannot be undone. Events with votes or payment history cannot be deleted.`} confirmLabel="Delete event permanently" onCancel={()=>setOpen(false)} onConfirm={()=>{approved.current=true;setOpen(false);form.current?.requestSubmit();}} /></>;
}
