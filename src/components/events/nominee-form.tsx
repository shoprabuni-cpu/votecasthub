"use client";

import { useActionState, useEffect, useState } from "react";
import { addCategoryNomineeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function NomineeForm({ categoryId, backTo }: { categoryId: string; backTo: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(addCategoryNomineeAction, null);
  const [values, setValues] = useState({ name: "", publicCode: "", biography: "" });
  useEffect(() => {
    if (state?.success) setValues({ name: "", publicCode: "", biography: "" });
  }, [state]);
  const updateValue = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  return <form action={formAction} className="nominee-form">
    <input type="hidden" name="categoryId" value={categoryId} />
    <input type="hidden" name="backTo" value={backTo} />
    <label htmlFor={`nominee-name-${categoryId}`}>Nominee name</label><input id={`nominee-name-${categoryId}`} name="name" minLength={1} maxLength={160} required value={values.name} onChange={(event) => updateValue("name", event.target.value)} placeholder="Full name or entry name" />
    <label htmlFor={`nominee-code-${categoryId}`}>Public code <span>optional</span></label><input id={`nominee-code-${categoryId}`} name="publicCode" maxLength={32} pattern="[A-Za-z0-9-]*" value={values.publicCode} onChange={(event) => updateValue("publicCode", event.target.value)} placeholder="e.g. BNA-01" />
    <label htmlFor={`nominee-bio-${categoryId}`}>Biography <span>optional</span></label><textarea id={`nominee-bio-${categoryId}`} name="biography" maxLength={3000} rows={3} value={values.biography} onChange={(event) => updateValue("biography", event.target.value)} placeholder="A short profile shown to voters." />
    {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Adding…" : "Add nominee"}</button>
  </form>;
}
