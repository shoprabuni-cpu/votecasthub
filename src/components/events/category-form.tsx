"use client";

import { useActionState } from "react";
import { addEventCategoryAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function CategoryForm({ eventId, backTo }: { eventId: string; backTo: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(addEventCategoryAction, null);
  return <form action={formAction} className="inline-create-form">
    <input type="hidden" name="eventId" value={eventId} />
    <input type="hidden" name="backTo" value={backTo} />
    <label htmlFor="category-name">Category name</label><input id="category-name" name="name" minLength={1} maxLength={120} required placeholder="e.g. Best New Artist" />
    <label htmlFor="category-description">Short description <span>optional</span></label><textarea id="category-description" name="description" maxLength={2000} rows={2} placeholder="What is this award for?" />
    {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Adding…" : "Add category"}</button>
  </form>;
}
