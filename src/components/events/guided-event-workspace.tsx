"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";
import { EventSetupContext, type SetupEditor, type SetupSection } from "./event-setup-context";

const steps = [
  { id: "details", label: "Event Basics" },
  { id: "voting", label: "Rules & Channels" },
  { id: "nominees", label: "Contestants" },
  { id: "review", label: "Review & Submit" },
] as const;
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
    if (section === "voting" && !(result?.setupReady ?? votingReady)) {
      setMessage("Voting settings saved. Complete the required voter access or payment setup below before continuing.");
      return;
    }
    void go(section === "details" ? "voting" : "nominees", true);
  }
  function next() {
    if (busy || requestedSave.current) return;
    if (section === "nominees" && stage.current?.querySelector('[data-setup-unsaved="true"]:not([hidden])')) {
      setMessage("Finish adding or saving your category or nominee before continuing.");
      return;
    }
    if (section === "nominees") {
      if (!nomineesReady) {
        setMessage("Add at least one category and an active nominee in each category before continuing.");
        return;
      }
      void go("review");
      return;
    }
    if (section === "details") {
      if (!editorControls.current || !editorControls.current.validate()) return;
      if (!editorState.dirty) {
        void go("voting");
        return;
      }
      continueAfterSave.current = true;
      requestedSave.current = true;
      editorControls.current.submit();
      return;
    }
    if (section === "voting") {
      if (!editorControls.current || !editorControls.current.validate()) return;
      if (!editorState.dirty) {
        if (!votingReady) {
          setMessage("Complete the required voter access or payment setup below before continuing.");
          return;
        }
        void go("nominees");
        return;
      }
      continueAfterSave.current = true;
      requestedSave.current = true;
      editorControls.current.submit();
      return;
    }
  }
  return <EventSetupContext.Provider value={{ section, registerEditor, reportEditor, editorSaved }}>
    <div className="space-y-5" onClick={event => {
      const trigger = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-workspace-section]");
      const target = steps.find(step => step.id === trigger?.dataset.workspaceSection);
      if (target) { continueAfterSave.current = false; void go(target.id); }
    }}>
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 mb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Event Studio</span>
            <h2 ref={heading} tabIndex={-1} className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900 focus:outline-none">
              {steps[index].label}
            </h2>
          </div>
          <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
            Step {index + 1} of 4
          </span>
        </div>
        <ol aria-label="Event setup progress" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((step, stepIndex) => {
            const isCurrent = step.id === section;
            const isCompleted = stepIndex < index;
            return (
              <li key={step.id} aria-current={isCurrent ? "step" : undefined}>
                <button
                  type="button"
                  onClick={() => { continueAfterSave.current = false; void go(step.id); }}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                    isCurrent
                      ? "bg-emerald-900 text-white shadow-xs"
                      : isCompleted
                      ? "bg-emerald-50 text-emerald-950 hover:bg-emerald-100/70"
                      : "text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isCurrent
                      ? "bg-emerald-700 text-white"
                      : isCompleted
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-stone-200 text-stone-600"
                  }`}>
                    {isCompleted ? "✓" : stepIndex + 1}
                  </span>
                  <span className="text-xs font-bold truncate">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
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
