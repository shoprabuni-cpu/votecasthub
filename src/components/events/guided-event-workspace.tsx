"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";
import { EventSetupContext, type SetupEditor, type SetupSection } from "./event-setup-context";

const steps = [
  { id: "details", label: "Event Basics", num: "01", sub: "Identity & Dates" },
  { id: "nominees", label: "Contestants", num: "02", sub: "Categories & Nominees" },
  { id: "voting", label: "Rules & Channels", num: "03", sub: "Pricing & Access" },
  { id: "review", label: "Review & Submit", num: "04", sub: "Launch Pre-Flight" },
] as const;
const buttonStyle = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
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
    void go(section === "details" ? "nominees" : "review", true);
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
      void go("voting");
      return;
    }
    if (section === "details") {
      if (!editorControls.current || !editorControls.current.validate()) return;
      if (!editorState.dirty) {
        void go("nominees");
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
        void go("review");
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
      <section className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-3 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e] sm:p-3.5">
        <h2 ref={heading} tabIndex={-1} className="sr-only focus:outline-none">
          {steps[index].label}
        </h2>
        <ol aria-label="Event setup progress" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((step, stepIndex) => {
            const isCurrent = step.id === section;
            const isCompleted = stepIndex < index;
            return (
              <li key={step.id} aria-current={isCurrent ? "step" : undefined}>
                <button
                  type="button"
                  onClick={() => { continueAfterSave.current = false; void go(step.id); }}
                  className={`group relative flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-all duration-200 cursor-pointer ${isCurrent
                    ? "bg-emerald-900 text-white shadow-xs ring-1 ring-emerald-800 dark:bg-emerald-800 dark:ring-emerald-700"
                    : isCompleted
                      ? "border border-emerald-200/80 bg-emerald-50/60 text-emerald-950 hover:bg-emerald-100/70 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : "border border-stone-200/80 bg-stone-50/40 text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800 dark:border-[#1c2721] dark:bg-[#141b16]/60 dark:text-stone-400 dark:hover:border-stone-700"
                    }`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all ${isCurrent
                    ? "bg-emerald-700 text-white dark:bg-emerald-600"
                    : isCompleted
                      ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                      : "bg-stone-200/80 text-stone-600 group-hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-400"
                    }`}>
                    {isCompleted ? "✓" : step.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold leading-tight">{step.label}</span>
                    <span className={`hidden text-[10px] leading-tight md:block truncate ${isCurrent ? "text-emerald-200/90" : "text-stone-400 dark:text-stone-500"}`}>
                      {step.sub}
                    </span>
                  </div>
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
      <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e] sm:p-5">
        {message && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">{message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={index === 0 || busy} onClick={() => { continueAfterSave.current = false; void go(steps[index - 1].id); }} className={`${buttonStyle} border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#141b16] dark:text-stone-200 dark:hover:bg-[#1c2721]`}><Icon name="arrowLeft" size={16} />Back</button>
          <div className="flex flex-wrap items-center gap-3">{section === "review" ? viewLink : <>
            <p className="text-xs text-stone-500 dark:text-stone-400">{editorState.pending ? "Saving your changes…" : section === "nominees" ? "Add as many contestants as you need." : "Your changes are saved before continuing."}</p>
            <button type="button" onClick={next} disabled={busy} className={`${buttonStyle} bg-emerald-900 text-white shadow-xs hover:bg-emerald-800 dark:bg-emerald-800 dark:hover:bg-emerald-700`}>{editorState.pending ? "Saving…" : section === "nominees" ? "Continue to Rules" : "Save & Continue"}<Icon name="arrowRight" size={16} /></button>
          </>}</div>
        </div>
      </div>
    </div>
  </EventSetupContext.Provider>;
}
