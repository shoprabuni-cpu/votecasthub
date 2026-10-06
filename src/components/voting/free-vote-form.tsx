"use client";

import Link from "next/link";
import { useActionState } from "react";
import { castFreeVotesAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function FreeVoteForm({ eventId, categoryId, nomineeId, nomineeName, nextPath, maxQuantity, requestKey, phoneVerified, verificationMethod }: {
  eventId: string;
  categoryId: string;
  nomineeId: string;
  nomineeName: string;
  nextPath: string;
  maxQuantity: number;
  requestKey: string;
  phoneVerified: boolean;
  verificationMethod?: "phone" | "email" | "invite_code" | "voter_list";
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(castFreeVotesAction, null);
  const activeRequestKey = state?.success && state.nextRequestKey ? state.nextRequestKey : requestKey;

  if (!phoneVerified) { const email = verificationMethod === "email"; return <Link className="vote-sign-in" href={`/${email ? "email-sign-in" : "phone-sign-in"}?next=${encodeURIComponent(nextPath)}`}>{email ? "Verify email to vote" : "Verify phone to vote"} <span aria-hidden="true">→</span></Link>; }

  return <form action={action} className={`free-vote-form${pending ? " is-submitting" : ""}`} aria-busy={pending}>
    <input type="hidden" name="eventId" value={eventId} />
    <input type="hidden" name="categoryId" value={categoryId} />
    <input type="hidden" name="nomineeId" value={nomineeId} />
    <input type="hidden" name="requestKey" value={activeRequestKey} />
    <label htmlFor={`votes-${nomineeId}`}>Votes</label>
    <select id={`votes-${nomineeId}`} name="quantity" defaultValue="1" aria-label={`Number of votes for ${nomineeName}`}>
      {Array.from({ length: Math.max(1, Math.min(maxQuantity, 100)) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
    </select>
    <small className="vote-limit-remaining">{maxQuantity} {maxQuantity === 1 ? "vote" : "votes"} available under this rule</small>
    <button type="submit" disabled={pending}>{pending ? "Recording your vote…" : "Vote free"}</button>
    {state?.message && <p className={`vote-form-message${state.success ? " is-success" : ""}`} role={state.success ? "status" : "alert"} aria-live="polite">{state.success ? <><strong>Vote recorded</strong><br />{nomineeName} · {state.message}</> : state.message}</p>}
  </form>;
}
