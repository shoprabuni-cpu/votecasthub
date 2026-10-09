"use client";
import { useActionState } from "react";
import { setEventVoterHelpAction } from "@/lib/events/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function VoterHelpSettings({ eventId, email }: { eventId: string; email: string | null }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(setEventVoterHelpAction, null);
  return <section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-lg font-semibold">Voter help contact</h2><p className="mt-2 text-sm text-stone-600">Choose an email address voters can contact about missing list entries, private codes or voting allowances. This address will be public. Leave it empty to show platform support.</p><form action={action} className="mt-4 space-y-3"><input type="hidden" name="eventId" value={eventId} /><label htmlFor="voter-help-email" className="block text-sm font-semibold">Public organizer help email</label><input id="voter-help-email" name="email" type="email" maxLength={254} defaultValue={email ?? ""} className="w-full rounded-xl border border-stone-300 p-3 text-base" /><button disabled={pending} className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save help contact"}</button>{state?.message && <p role="status" className="text-sm">{state.message}</p>}</form></section>;
}
