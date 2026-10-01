"use client";

import { useActionState } from "react";
import { addCategoryNomineeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function NomineeForm({ categoryId, backTo }: { categoryId: string; backTo: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(addCategoryNomineeAction, null);
  return <form action={formAction} className="nominee-form">
    <input type="hidden" name="categoryId" value={categoryId} />
    <input type="hidden" name="backTo" value={backTo} />
    <label htmlFor={`nominee-name-${categoryId}`}>Nominee name</label><input id={`nominee-name-${categoryId}`} name="name" minLength={1} maxLength={160} required placeholder="Full name or entry name" />
    <label htmlFor={`nominee-code-${categoryId}`}>Public code <span>optional</span></label><input id={`nominee-code-${categoryId}`} name="publicCode" maxLength={32} pattern="[A-Za-z0-9-]+" placeholder="e.g. BNA-01" />
    <label htmlFor={`nominee-bio-${categoryId}`}>Biography <span>optional</span></label><textarea id={`nominee-bio-${categoryId}`} name="biography" maxLength={3000} rows={3} placeholder="A short profile shown to voters." />
    {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Adding…" : "Add nominee"}</button>
  </form>;
}
