"use client";

import Link from "next/link";
import { useActionState } from "react";
import { castFreeVotesAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";

export function FreeVoteForm({
  eventId,
  categoryId,
  nomineeId,
  nomineeName,
  nextPath,
  maxQuantity,
  requestKey,
  phoneVerified,
  verificationMethod = "phone",
}: {
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

  if (!phoneVerified) {
    if (verificationMethod === "email") {
      return (
        <Link
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-2.5 px-3 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-stone-300 transition-all cursor-pointer"
          href={`/email-sign-in?next=${encodeURIComponent(nextPath)}`}
        >
          <Icon name="mail" size={13} />
          <span>Verify email to vote</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      );
    }
    if (verificationMethod === "invite_code") {
      return (
        <a
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/70 py-2.5 px-3 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 transition-all cursor-pointer"
          href="#voter-verification"
        >
          <Icon name="shield" size={13} />
          <span>Enter access code above</span>
          <span aria-hidden="true">&uarr;</span>
        </a>
      );
    }
    if (verificationMethod === "voter_list") {
      return (
        <a
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/70 py-2.5 px-3 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 transition-all cursor-pointer"
          href="#voter-verification"
        >
          <Icon name="shield" size={13} />
          <span>Verify voter roster above</span>
          <span aria-hidden="true">&uarr;</span>
        </a>
      );
    }
    return (
      <Link
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-2.5 px-3 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-stone-300 transition-all cursor-pointer"
        href={`/phone-sign-in?next=${encodeURIComponent(nextPath)}`}
      >
        <Icon name="phone" size={13} />
        <span>Verify phone to vote</span>
        <span aria-hidden="true">&rarr;</span>
      </Link>
    );
  }

  return (
    <form action={action} className="space-y-2.5" aria-busy={pending}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="nomineeId" value={nomineeId} />
      <input type="hidden" name="requestKey" value={activeRequestKey} />

      <div className="flex items-center gap-2">
        <label htmlFor={`votes-${nomineeId}`} className="sr-only">
          Votes for {nomineeName}
        </label>
        <select
          id={`votes-${nomineeId}`}
          name="quantity"
          defaultValue="1"
          aria-label={`Number of votes for ${nomineeName}`}
          disabled={pending}
          className="rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        >
          {Array.from({ length: Math.max(1, Math.min(maxQuantity, 100)) }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {index + 1} {index === 0 ? "vote" : "votes"}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <>
              <Icon name="refresh" size={13} className="animate-spin" />
              <span>Recording…</span>
            </>
          ) : (
            <span>Vote free</span>
          )}
        </button>
      </div>

      <p className="text-[10px] text-stone-500 font-medium">
        {maxQuantity} {maxQuantity === 1 ? "vote" : "votes"} remaining
      </p>

      {state?.message && (
        <div
          className={`rounded-xl p-2.5 text-xs font-medium ${
            state.success
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
          role={state.success ? "status" : "alert"}
          aria-live="polite"
        >
          {state.success ? (
            <div>
              <strong className="block font-semibold">Vote recorded!</strong>
              <span>{nomineeName} &middot; {state.message}</span>
            </div>
          ) : (
            state.message
          )}
        </div>
      )}
    </form>
  );
}
