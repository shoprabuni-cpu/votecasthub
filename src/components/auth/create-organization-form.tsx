"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createOrganizationAction, null);
  return <form action={formAction} className="organization-form">
    <label htmlFor="organization-name">Organization name</label>
    <div className="organization-form-row">
      <input id="organization-name" name="name" type="text" minLength={2} maxLength={120} required placeholder="Your awards, school, or event team" />
      <button className="primary-link auth-submit" type="submit" disabled={pending}>{pending ? "Creating…" : "Create organization"}</button>
    </div>
    {state?.message && <p className="form-message" role="alert">{state.message}</p>}
  </form>;
}
