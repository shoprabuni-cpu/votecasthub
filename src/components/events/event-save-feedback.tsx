"use client";

import { createContext, useActionState, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AuthFormState } from "@/lib/auth/form-state";
import { EventDialog } from "./event-dialog";

const EditContext = createContext<((id: string, dirty: boolean) => void) | null>(null);

export function EventLeaveGuard({ children }: { children: ReactNode }) {
  const [forms, setForms] = useState<Record<string, boolean>>({});
  const [destination, setDestination] = useState<string | null>(null);
  const approved = useRef(false);
  const router = useRouter();
  const dirty = Object.values(forms).some(Boolean);
  const report = useCallback((id: string, changed: boolean) => setForms(current => {
    if (current[id] === changed || (!changed && !(id in current))) return current;
    const next = { ...current };
    if (changed) next[id] = true; else delete next[id];
    return next;
  }), []);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { if (!approved.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof window.Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const next = new URL(link.href, window.location.href);
      if (!["http:", "https:"].includes(next.protocol) || (next.origin === window.location.origin && next.pathname === window.location.pathname && next.search === window.location.search)) return;
      event.preventDefault(); event.stopPropagation(); setDestination(next.href);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  return <EditContext.Provider value={report}>{children}<EventDialog open={destination !== null} title="Leave without saving?" onClose={() => setDestination(null)}>
    <p className="text-sm leading-6 text-stone-600">You have unsaved event changes. Stay here to save them, or leave and discard your edits.</p>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setDestination(null)} className="min-h-11 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Keep editing</button><button type="button" onClick={() => {
      if (!destination) return;
      const next = new URL(destination);
      setDestination(null);
      if (next.origin === window.location.origin) router.push(next.pathname + next.search + next.hash);
      else { approved.current = true; window.location.assign(next.href); }
    }} className="min-h-11 rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 border-stone-300 bg-white shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Leave without saving</button></div>
  </EventDialog></EditContext.Provider>;
}

export function useEventSaveFeedback(action: (state: AuthFormState, data: FormData) => Promise<AuthFormState>) {
  const id = useId();
  const report = useContext(EditContext);
  const revision = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(async (previous, data) => {
    const submitted = revision.current;
    const result = await action(previous, data);
    if (result?.success && revision.current === submitted) { setDirty(false); report?.(id, false); }
    return result;
  }, null);
  const markChanged = () => { revision.current += 1; setDirty(true); report?.(id, true); };
  useEffect(() => () => report?.(id, false), [id, report]);
  useEffect(() => {
    if (!dirty || report) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty, report]);
  return { state, formAction, pending, dirty, markChanged };
}

export function EventSaveFeedback({ dirty, pending, state, announce = true }: { dirty: boolean; pending: boolean; state: AuthFormState; announce?: boolean }) {
  const error = state?.message && !state.success;
  return <div role={announce ? error ? "alert" : "status" : undefined} aria-live={announce ? "polite" : "off"} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : pending ? "border-stone-200 bg-stone-50 text-stone-600" : dirty ? "border-amber-200 bg-amber-50 text-amber-900" : state?.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-stone-200 bg-stone-50 text-stone-600"}`}>
    <span aria-hidden="true" className="mt-0.5 shrink-0">{pending ? "…" : error ? "!" : dirty ? "•" : state?.success ? "✓" : "i"}</span>
    <span>{pending ? "Saving your changes…" : error ? state.message : dirty ? "You have unsaved changes. Save when you’re ready." : state?.success ? "Changes saved. You’re all set." : "Changes are saved when you press Save."}</span>
  </div>;
}
