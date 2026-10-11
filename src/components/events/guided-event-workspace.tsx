"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";
import { EventSetupContext, type SetupEditor, type SetupSection } from "./event-setup-context";

const steps = [{ id: "details", label: "Event details" }, { id: "nominees", label: "Categories & nominees" }, { id: "voting", label: "Voting settings" }, { id: "review", label: "Review & Submit" }] as const;
const buttonStyle = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
export function GuidedEventWorkspace({ details, nominees, voting, review, editor, viewLink, initialSection = "details", nomineesReady, votingReady = true }: {
  details: ReactNode; nominees: ReactNode; voting: ReactNode; review: ReactNode; editor: ReactNode; viewLink: ReactNode;
  initialSection?: SetupSection; nomineesReady: boolean; votingReady?: boolean;
}) {
  const [section, setSection] = useState<SetupSection>(initialSection);
  const [transitioning, setTransitioning] = useState(false);
  const [editorState, setEditorState] = useState({ dirty: false, pending: false });
  const [message, setMessage] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const editorControls = useRef<SetupEditor | null>(null);
  const continueAfterSave = useRef(false);
  const requestedSave = useRef(false);
  const moving = useRef(false);
  const index = steps.findIndex(step => step.id === section);
  const busy = editorState.pending || transitioning;
  const registerEditor = useCallback((controls: SetupEditor) => { editorControls.current = controls; }, []);
  const reportEditor = useCallback((value: { dirty: boolean; pending: boolean }) => {
    if (!value.pending) requestedSave.current = false;
    setEditorState(current => current.dirty === value.dirty && current.pending === value.pending ? current : value);
  }, []);
  async function go(target: SetupSection, saved = false) {
    if (moving.current || target === section || (editorState.pending && !saved)) return;
    moving.current = true; setTransitioning(true); setMessage(null);
    const direction = steps.findIndex(step => step.id === target) > index ? 1 : -1;
    const element = stage.current;
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      if (element?.animate && !reduceMotion) {
        await element.animate([{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: `translateX(${-direction * 36}px)` }], { duration: 130, easing: "ease-in", fill: "forwards" }).finished;
      }
      setSection(target);
      if (element?.animate && !reduceMotion) {
        await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
        element.getAnimations().forEach(animation => animation.cancel());
        await element.animate([{ opacity: 0, transform: `translateX(${direction * 36}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" }).finished;
      }
      heading.current?.focus({ preventScroll: true });
    } finally {
      element?.getAnimations?.().forEach(animation => animation.cancel());
      moving.current = false; setTransitioning(false);
    }
  }
  function editorSaved(result: AuthFormState) {
    if (!continueAfterSave.current) return;
    continueAfterSave.current = false;
    if (section === "voting" && !(result?.setupReady ?? votingReady)) { setMessage("Voting settings saved. Complete the required voter access or payment setup below before continuing."); return; }
    void go(section === "details" ? "nominees" : "review", true);
  }
  function next() {
    if (busy || requestedSave.current) return;
    if (section === "nominees" && stage.current?.querySelector('[data-setup-unsaved="true"]:not([hidden])')) {
      setMessage("Finish adding or saving your category or nominee before continuing."); return;
    }
    if (section === "nominees") {
      if (!nomineesReady) { setMessage("Add at least one category and an active nominee in each category before continuing."); return; }
      void go("voting"); return;
    }
    if (section === "details" || section === "voting") {
      if (!editorControls.current || !editorControls.current.validate()) return;
      if (!editorState.dirty) {
        if (section === "voting" && !votingReady) { setMessage("Complete the required voter access or payment setup below before continuing."); return; }
        void go(section === "details" ? "nominees" : "review"); return; }
      continueAfterSave.current = true; requestedSave.current = true; editorControls.current.submit();
    }
  }
  return <EventSetupContext.Provider value={{ section, registerEditor, reportEditor, editorSaved }}>
    <div className="space-y-5" onClick={event => {
      const trigger = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-workspace-section]");
      const target = steps.find(step => step.id === trigger?.dataset.workspaceSection);
      if (target) { continueAfterSave.current = false; void go(target.id); }
    }}>
      <section className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 via-white to-stone-50 p-5 shadow-xs sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Event setup</p>
        <h2 ref={heading} tabIndex={-1} className="mt-1 text-xl font-semibold tracking-tight text-stone-900 focus:outline-none">{steps[index].label}</h2>
        <p className="mt-2 text-sm text-stone-600" aria-live="polite">Step {index + 1} of 4 · Complete one section at a time. You can go back without losing your entries.</p>
        <ol aria-label="Event setup progress" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{steps.map((step, stepIndex) => <li key={step.id} aria-current={step.id === section ? "step" : undefined} className={step.id === section ? "text-emerald-900" : "text-stone-500"}>
          <div className="flex items-start gap-2"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.id === section ? "bg-emerald-900 text-white" : "bg-stone-200/70 text-stone-600"}`}>{stepIndex + 1}</span><span className="pt-1 text-xs font-semibold leading-5">{step.label}</span></div>
        </li>)}</ol>
      </section>
      <div className="overflow-x-clip">
        <div ref={stage} className="space-y-5" aria-busy={busy}>
          <div id="workspace-editor" hidden={section !== "details" && section !== "voting"}>{editor}</div>
          <section id="workspace-details" aria-label="Event details" hidden={section !== "details"} className="space-y-5">{details}</section>
          <section id="workspace-nominees" aria-label="Categories and nominees" hidden={section !== "nominees"} className="space-y-5">{nominees}</section>
          <section id="workspace-voting" aria-label="Voting settings" hidden={section !== "voting"} className="space-y-5">{voting}</section>
          <section id="workspace-review" aria-label="Review and submit" hidden={section !== "review"} className="space-y-5">{review}</section>
        </div>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:p-5">
        {message && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={index === 0 || busy} onClick={() => { continueAfterSave.current = false; void go(steps[index - 1].id); }} className={`${buttonStyle} border border-stone-300 bg-white text-stone-800 hover:bg-stone-50`}><Icon name="arrowLeft" size={16} />Back</button>
          <div className="flex flex-wrap items-center gap-3">{section === "review" ? viewLink : <>
            <p className="text-xs text-stone-500">{editorState.pending ? "Saving your changes…" : section === "nominees" ? "Add as many nominees as you need." : "Your changes are saved before continuing."}</p>
            <button type="button" onClick={next} disabled={busy} className={`${buttonStyle} bg-emerald-900 text-white hover:bg-emerald-800`}>{editorState.pending ? "Saving…" : section === "nominees" ? "Continue" : "Save & Continue"}<Icon name="arrowRight" size={16} /></button>
          </>}</div>
        </div>
      </div>
    </div>
  </EventSetupContext.Provider>;
}
