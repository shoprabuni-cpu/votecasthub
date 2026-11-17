"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createEventAction, updateEventDraftAction } from "@/lib/auth/actions";
import { EventSaveFeedback, useEventSaveFeedback } from "./event-save-feedback";
import { votingRuleOptions, type VotingRule } from "@/lib/voting-rules";
import { useEventSetup } from "./event-setup-context";
import { Icon } from "@/components/icon";

type EventValues = {
  name: string;
  description: string | null;
  price: number;
  startsAt: string;
  endsAt: string;
  resultsVisibility: string;
  votingMode?: "free" | "paid";
  verificationMethod?: "phone" | "email" | "invite_code" | "voter_list";
  votingRule?: VotingRule;
  freeVoteLimit?: number | null;
  votingRules?: string | null;
  eventType?: "voting" | "ticketing" | "hybrid";
  venueName?: string | null;
  doorsOpenTime?: string | null;
};

function asLocalInput(value?: string) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function formatDateString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

function getEventDurationLabel(startsAt: string, endsAt: string) {
  if (!startsAt || !endsAt) return null;
  const start = new Date(`${startsAt}Z`).getTime();
  const end = new Date(`${endsAt}Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const diffHours = Math.round((end - start) / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  if (diffDays > 0 && remainingHours > 0) return `${diffDays}d ${remainingHours}h duration`;
  if (diffDays > 0) return `${diffDays} days active`;
  return `${diffHours} hours duration`;
}

const STEPS = [
  { id: 1, title: "Identity & Dates", subtitle: "Name & schedule" },
  { id: 2, title: "Voting & Pricing", subtitle: "Free vs. paid model" },
  { id: 3, title: "Rules & Visibility", subtitle: "Audience instructions" },
  { id: 4, title: "Review & Create", subtitle: "Final launch check" },
] as const;

function FormStepPresence({ grouped, direction, children }: { grouped: boolean; direction: number; children: ReactNode }) {
  return grouped ? <>{children}</> : <AnimatePresence mode="wait" custom={direction}>{children}</AnimatePresence>;
}

export function EventDetailsForm({
  organizationId,
  eventId,
  initial,
  smsBalance = null,
  creationFlow = false,
}: {
  organizationId: string;
  eventId?: string;
  initial?: EventValues;
  smsBalance?: number | null;
  creationFlow?: boolean;
}) {
  const action = eventId ? updateEventDraftAction : createEventAction;
  const setup = useEventSetup();
  const grouped = creationFlow || Boolean(setup);
  const formRef = useRef<HTMLFormElement>(null);
  const { state, formAction, pending, dirty, markChanged } = useEventSaveFeedback(action, setup?.editorSaved);

  const [localStep, setStep] = useState(1);
  const step = grouped ? setup?.section === "voting" ? 2 : 1 : localStep;
  const [direction, setDirection] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const [votingMode, setVotingModeValue] = useState<"free" | "paid">(initial?.votingMode ?? "free");
  const [verificationMethod, setVerificationMethodValue] = useState<"phone" | "email" | "invite_code" | "voter_list">(
    initial?.verificationMethod ?? "phone"
  );
  const [votingRule, setVotingRuleValue] = useState<VotingRule>(initial?.votingRule ?? "one_per_category");
  const setVotingMode = (value: "free" | "paid") => { markChanged(); setVotingModeValue(value); };
  const setVerificationMethod = (value: "phone" | "email" | "invite_code" | "voter_list") => { markChanged(); setVerificationMethodValue(value); };
  const setVotingRule = (value: VotingRule) => { markChanged(); setVotingRuleValue(value); };

  const [eventType, setEventTypeValue] = useState<"voting" | "ticketing" | "hybrid">(initial?.eventType ?? "voting");
  const [venueName, setVenueName] = useState(initial?.venueName ?? "");
  const [doorsOpenTime, setDoorsOpenTime] = useState(initial?.doorsOpenTime ?? "");
  const setEventType = (value: "voting" | "ticketing" | "hybrid") => {
    markChanged();
    setEventTypeValue(value);
  };

  const [values, setValues] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    priceGhs: initial?.votingMode === "paid" ? (initial.price / 100).toFixed(2) : "1.00",
    freeVoteLimit: String(initial?.votingMode === "free" ? initial.freeVoteLimit ?? 1 : 1),
    votingRules: initial?.votingRules ?? "",
    resultsVisibility: initial?.resultsVisibility ?? "organizer_only",
    startsAt: asLocalInput(initial?.startsAt),
    endsAt: asLocalInput(initial?.endsAt),
  });

  const updateValue = (field: keyof typeof values, value: string) => {
    markChanged();
    setStepError(null);
    setValues((current) => ({ ...current, [field]: value }));
  };

  const allowanceMode: "one_per_category" | "single_choice" | "custom_limit" =
    votingRule === "one_per_category"
      ? "one_per_category"
      : votingRule === "per_nominee_limit" && values.freeVoteLimit === "1"
      ? "single_choice"
      : "custom_limit";

  const selectAllowanceMode = (mode: "one_per_category" | "single_choice" | "custom_limit") => {
    markChanged();
    setStepError(null);
    if (mode === "one_per_category") {
      setVotingRule("one_per_category");
      updateValue("freeVoteLimit", "1");
    } else if (mode === "single_choice") {
      setVotingRule("per_nominee_limit");
      updateValue("freeVoteLimit", "1");
    } else {
      setVotingRule("category_limit");
      const current = Number.parseInt(values.freeVoteLimit, 10);
      if (Number.isNaN(current) || current <= 1) {
        updateValue("freeVoteLimit", "3");
      }
    }
  };

  const audienceContext = {
    phone: {
      label: "Open to Public",
      badge: "Tracked per verified Ghana Phone / WhatsApp",
      catDesc: "Each verified phone number can cast 1 vote in every category (1 for Best Male, 1 for Best Female, etc.).",
      singleDesc: "Once a verified phone casts a single vote anywhere in the competition, their ballot is permanently locked.",
      customDesc: (n: string) => `Each verified phone gets a total wallet allowance of ${n} votes to spend across any nominees.`,
    },
    invite_code: {
      label: "VIP / Delegate Passcodes",
      badge: "Unlocked by secret 1-time VIP code",
      catDesc: "Each VIP invite code unlocks a full digital ballot (1 vote in every category).",
      singleDesc: "Each VIP code is good for exactly 1 single vote total, then permanently expires.",
      customDesc: (n: string) => `Each VIP code grants a balance of ${n} votes for the delegate to cast.`,
    },
    voter_list: {
      label: "Restricted Voter Roll",
      badge: "Bound to Student ID / Index Number on roster",
      catDesc: "Every Student ID or Index Number on your roster gets 1 vote in every category.",
      singleDesc: "Every student or delegate on your roster can vote for 1 single candidate across the entire election.",
      customDesc: (n: string) => `Default: ${n} votes per student on the list (or specify custom votes per person in your CSV).`,
    },
    email: {
      label: "Email Passcode",
      badge: "Verified via 6-digit email OTP",
      catDesc: "Each verified email address can cast 1 vote in every category.",
      singleDesc: "Each verified email can vote for 1 single candidate across the entire competition.",
      customDesc: (n: string) => `Each verified email address gets ${n} votes to distribute across candidates.`,
    },
  };

  // Quick Date Presets
  const applyDatePreset = (preset: "tomorrow" | "7days" | "14days" | "30days") => {
    markChanged();
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(9, 0, 0, 0); // Ghana time is UTC, regardless of browser timezone.

    const end = new Date(start);
    if (preset === "tomorrow") end.setUTCDate(end.getUTCDate() + 3);
    else if (preset === "7days") end.setUTCDate(end.getUTCDate() + 7);
    else if (preset === "14days") end.setUTCDate(end.getUTCDate() + 14);
    else if (preset === "30days") end.setUTCDate(end.getUTCDate() + 30);
    end.setUTCHours(23, 59, 0, 0);

    setValues((prev) => ({
      ...prev,
      startsAt: formatDateString(start),
      endsAt: formatDateString(end),
    }));
    setStepError(null);
  };

  // Step Validation before progressing
  const validateStep = (currentStep: number): boolean => {
    setStepError(null);
    if (currentStep === 1) {
      if (!values.name.trim() || values.name.trim().length < 2) {
        setStepError("Please provide an event name (at least 2 characters).");
        return false;
      }
      if (!values.startsAt) {
        setStepError("Please set the date and time when voting starts.");
        return false;
      }
      if (!values.endsAt) {
        setStepError("Please set the date and time when voting ends.");
        return false;
      }
      if (new Date(`${values.startsAt}Z`) >= new Date(`${values.endsAt}Z`)) {
        setStepError("Voting end time must be after the start time.");
        return false;
      }
    }
    if (currentStep === 2) {
      if (votingMode === "paid") {
        const numPrice = Number.parseFloat(values.priceGhs);
        if (Number.isNaN(numPrice) || numPrice < 0.01) {
          setStepError("Please enter a valid vote price in Ghana Cedis (minimum GH₵ 0.01).");
          return false;
        }
      } else {
        const numLimit = Number.parseInt(values.freeVoteLimit, 10);
        if (Number.isNaN(numLimit) || numLimit < 1 || numLimit > 100) {
          setStepError("Free vote limit must be between 1 and 100.");
          return false;
        }
      }
    }
    return true;
  };

  const reportEditor = setup?.reportEditor;
  useEffect(() => { reportEditor?.({ dirty, pending }); }, [dirty, pending, reportEditor]);
  useEffect(() => {
    setup?.registerEditor({ submit: () => formRef.current?.requestSubmit(), validate: () => validateStep(1) && validateStep(2) });
  });

  const handleNext = () => {
    if (validateStep(step)) {
      setDirection(1);
      setStep((s) => Math.min(s + 1, 4));
    }
  };

  const handleBack = () => {
    setStepError(null);
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  const jumpToStep = (targetStep: number) => {
    if (targetStep < step || validateStep(step)) {
      setDirection(targetStep > step ? 1 : -1);
      setStep(targetStep);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 30 : -30,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.24, ease: [0.25, 1, 0.5, 1] as const },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -30 : 30,
      opacity: 0,
      transition: { duration: 0.18, ease: "easeIn" as const },
    }),
  };

  return (
    <div className="w-full space-y-4">
      <EventSaveFeedback dirty={dirty} pending={pending} state={state} />
      {/* Existing full editor remains available outside guided setup. */}
      {!grouped && <div className="mb-8 rounded-2xl border border-stone-200/90 bg-white/90 p-3 sm:p-4 shadow-xs backdrop-blur-sm transition-colors dark:border-[#1c2721] dark:bg-[#0c120e]/90">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isCurrent = step === s.id;
            const isCompleted = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpToStep(s.id)}
                className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 group relative flex items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-200 ${
                  isCurrent
                    ? "bg-emerald-900 text-white shadow-xs ring-1 ring-emerald-800 dark:bg-emerald-800 dark:ring-emerald-700"
                    : isCompleted
                    ? "border border-emerald-200/80 bg-emerald-50/60 text-emerald-950 hover:bg-emerald-100/70 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border border-stone-200/80 bg-stone-50/40 text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800 dark:border-[#1c2721] dark:bg-[#141b16]/60 dark:text-stone-400 dark:hover:border-stone-700"
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-emerald-700 text-white dark:bg-emerald-600"
                      : isCompleted
                      ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                      : "bg-stone-200/80 text-stone-600 group-hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-400"
                  }`}
                >
                  {isCompleted ? <Icon name="check" size={12} /> : `0${s.id}`}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-bold leading-tight truncate ${
                      isCurrent ? "text-white" : isCompleted ? "text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    {s.id === 4 && eventId ? "Review & Save" : s.title}
                  </p>
                  <p
                    className={`text-[10px] leading-tight truncate hidden md:block ${
                      isCurrent ? "text-emerald-200/90" : "text-stone-400 dark:text-stone-500"
                    }`}
                  >
                    {s.id === 4 && eventId ? "Check your changes" : s.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>}
      {creationFlow && (
        <div className="mb-6 rounded-2xl border border-stone-200/90 bg-white/90 p-3 sm:p-4 shadow-xs backdrop-blur-sm transition-colors dark:border-[#1c2721] dark:bg-[#0c120e]/90">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 1, title: "Event Basics", subtitle: "Name, story & dates" },
              { id: 2, title: "Contestants", subtitle: "Categories & nominees" },
              { id: 3, title: "Rules & Channels", subtitle: "Pricing & Access" },
              { id: 4, title: "Review & Submit", subtitle: "Platform pre-flight" },
            ].map((s) => {
              const isCurrent = s.id === 1;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                    isCurrent
                      ? "bg-emerald-900 text-white shadow-xs ring-1 ring-emerald-800 dark:bg-emerald-800 dark:ring-emerald-700"
                      : "border border-stone-200/80 bg-stone-50/40 text-stone-500 dark:border-[#1c2721] dark:bg-[#141b16]/60 dark:text-stone-400"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                      isCurrent ? "bg-emerald-700 text-white dark:bg-emerald-600" : "bg-stone-200/80 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                    }`}
                  >
                    0{s.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold leading-tight truncate ${isCurrent ? "text-white" : "text-stone-700 dark:text-stone-300"}`}>
                      {s.title}
                    </p>
                    <p className={`text-[10px] leading-tight truncate hidden md:block ${isCurrent ? "text-emerald-200/90" : "text-stone-400 dark:text-stone-500"}`}>
                      {s.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form ref={formRef} action={formAction} onSubmit={event => { if (grouped && (!validateStep(1) || !validateStep(2))) event.preventDefault(); }} className="relative">
        {grouped && <input type="hidden" name="setupFlow" value="guided" />}
        {/* Hidden inputs to guarantee complete formData payload without relying on DOM visibility */}
        <input type="hidden" name="organizationId" value={organizationId} />
        {eventId && <input type="hidden" name="eventId" value={eventId} />}
        <input type="hidden" name="name" value={values.name} />
        <input type="hidden" name="description" value={values.description} />
        <input type="hidden" name="votingMode" value={votingMode} />
        <input type="hidden" name="verificationMethod" value={verificationMethod} />
        <input type="hidden" id="input-voting-rule" name="votingRule" value={votingRule} />
        <input type="hidden" name="priceGhs" value={values.priceGhs} />
        <input type="hidden" name="freeVoteLimit" value={values.freeVoteLimit} />
        <input type="hidden" name="votingRules" value={values.votingRules} />
        <input type="hidden" name="resultsVisibility" value={values.resultsVisibility} />
        <input type="hidden" name="startsAt" value={values.startsAt} />
        <input type="hidden" name="endsAt" value={values.endsAt} />
        <input type="hidden" name="event_type" value={eventType} />
        <input type="hidden" name="venue_name" value={venueName} />
        <input type="hidden" name="doors_open_time" value={doorsOpenTime} />

        {/* Step Views */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-8 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e]">
          <FormStepPresence grouped={grouped} direction={direction}>
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={slideVariants}
                initial={grouped ? false : "enter"}
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <div className="border-b border-stone-100 pb-4 dark:border-[#1c2721]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">
                      [ 01 // BASICS & TIMELINE ]
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      Essential Setup
                    </span>
                  </div>
                  <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    What are you celebrating?
                  </h2>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Give your event a memorable title, brief context, and set the voting window in Ghana time.
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Event Format Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        [ FORMAT // ARCHITECTURE ] <span className="text-emerald-700 dark:text-emerald-400">*</span>
                      </label>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500">Choose event type</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEventType("voting")}
                        className={`rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                          eventType === "voting"
                            ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600/30 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-stone-200/90 bg-stone-50/40 text-stone-700 hover:border-stone-300 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#141b16]/40 dark:text-stone-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🗳️</span>
                          <span className="text-xs font-bold">Voting Contest</span>
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">Awards, polls & elections</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventType("ticketing")}
                        className={`rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                          eventType === "ticketing"
                            ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600/30 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-stone-200/90 bg-stone-50/40 text-stone-700 hover:border-stone-300 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#141b16]/40 dark:text-stone-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🎟️</span>
                          <span className="text-xs font-bold">Tickets Only</span>
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">Concerts, summits, passes</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventType("hybrid")}
                        className={`rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                          eventType === "hybrid"
                            ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600/30 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-stone-200/90 bg-stone-50/40 text-stone-700 hover:border-stone-300 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#141b16]/40 dark:text-stone-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🎟️ + 🗳️</span>
                          <span className="text-xs font-bold">Voting + Tickets</span>
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">Awards with ticketed gala</p>
                      </button>
                    </div>
                  </div>

                  {/* Event Name */}
                  <div className="rounded-2xl border border-stone-200/90 bg-stone-50/30 p-4 transition-all focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-3 focus-within:ring-emerald-600/10 dark:border-[#1c2721] dark:bg-[#141b16]/30 dark:focus-within:border-emerald-500 dark:focus-within:bg-[#0c120e]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="input-event-name" className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                        Official Event Name <span className="text-emerald-700 dark:text-emerald-400">*</span>
                      </label>
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
                        [{String(values.name.length).padStart(3, "0")} / 160]
                      </span>
                    </div>
                    <input
                      id="input-event-name"
                      type="text"
                      minLength={2}
                      maxLength={160}
                      value={values.name}
                      onChange={(e) => updateValue("name", e.target.value)}
                      placeholder="e.g. AAMUSTED Student Choice Awards 2026"
                      className="w-full bg-transparent text-sm sm:text-base font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-stone-100 dark:placeholder:text-stone-600"
                    />
                    <p className="mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                      Appears on voter ballots, digital certificates, and share previews.
                    </p>
                  </div>

                  {/* Venue & Time for Tickets */}
                  {(eventType === "ticketing" || eventType === "hybrid") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-900/40">
                      <div>
                        <label htmlFor="input-venue-name" className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 block mb-1">
                          Venue / Location Name
                        </label>
                        <input
                          id="input-venue-name"
                          type="text"
                          value={venueName}
                          onChange={(e) => { markChanged(); setVenueName(e.target.value); }}
                          placeholder="e.g. Accra International Conference Centre"
                          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-100"
                        />
                      </div>
                      <div>
                        <label htmlFor="input-doors-open" className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 block mb-1">
                          Doors Open / Red Carpet Time
                        </label>
                        <input
                          id="input-doors-open"
                          type="text"
                          value={doorsOpenTime}
                          onChange={(e) => { markChanged(); setDoorsOpenTime(e.target.value); }}
                          placeholder="e.g. 7:00 PM GMT"
                          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-100"
                        />
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="rounded-2xl border border-stone-200/90 bg-stone-50/30 p-4 transition-all focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-3 focus-within:ring-emerald-600/10 dark:border-[#1c2721] dark:bg-[#141b16]/30 dark:focus-within:border-emerald-500 dark:focus-within:bg-[#0c120e]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="input-event-description" className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                        Event Story & Context <span className="text-stone-400 font-normal">· optional</span>
                      </label>
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
                        [{String(values.description.length).padStart(4, "0")} / 5000]
                      </span>
                    </div>
                    <textarea
                      id="input-event-description"
                      rows={3}
                      maxLength={5000}
                      value={values.description}
                      onChange={(e) => updateValue("description", e.target.value)}
                      placeholder="Briefly describe what this awards ceremony, contest, or election stands for..."
                      className="w-full resize-none bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-stone-100 dark:placeholder:text-stone-600 leading-relaxed"
                    />
                  </div>

                  {/* Date Pickers with Ghana Helpers */}
                  <div className="rounded-2xl border border-stone-200/90 bg-stone-50/40 p-4 sm:p-5 dark:border-[#1c2721] dark:bg-[#141b16]/40 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-3 dark:border-[#1c2721]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-400">
                          [ SCHEDULE // GMT +00:00 GHANA ]
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600 dark:bg-emerald-400" />
                          Ghana Telco Time
                        </span>
                      </div>
                      {/* Presets */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono hidden sm:inline">PRESETS:</span>
                        {(["7days", "14days", "30days"] as const).map((preset) => {
                          const label = preset === "7days" ? "+7 Days" : preset === "14days" ? "+14 Days" : "+30 Days";
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => applyDatePreset(preset)}
                              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold text-stone-700 shadow-2xs hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition-all active:scale-95 cursor-pointer dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:border-emerald-600"
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-[#223028] dark:bg-[#0c120e]">
                        <label htmlFor="input-starts-at" className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                          Voting Opens (GMT)
                        </label>
                        <input
                          id="input-starts-at"
                          type="datetime-local"
                          value={values.startsAt}
                          onChange={(e) => updateValue("startsAt", e.target.value)}
                          className="w-full bg-transparent font-mono text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none dark:text-stone-100"
                        />
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-[#223028] dark:bg-[#0c120e]">
                        <label htmlFor="input-ends-at" className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                          Voting Closes (GMT)
                        </label>
                        <input
                          id="input-ends-at"
                          type="datetime-local"
                          value={values.endsAt}
                          onChange={(e) => updateValue("endsAt", e.target.value)}
                          className="w-full bg-transparent font-mono text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none dark:text-stone-100"
                        />
                      </div>
                    </div>

                    {getEventDurationLabel(values.startsAt, values.endsAt) && (
                      <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 border border-emerald-200/80 px-3.5 py-2 text-xs font-medium text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-300">
                        <span className="flex items-center gap-1.5 font-bold">
                          <span>⏳</span>
                          <span>Active Period: {getEventDurationLabel(values.startsAt, values.endsAt)}</span>
                        </span>
                        <span className="font-mono text-[10px] text-emerald-800 dark:text-emerald-400">Accra GMT</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <div className="border-b border-stone-100 pb-4 dark:border-[#1c2721]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">
                      [ 03 // RULES & CHANNELS ]
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {votingMode === "paid" ? "Paystack Mobile Money" : "Fair Ballot System"}
                    </span>
                  </div>
                  <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    {eventType === "ticketing" ? "Ticketed Event Setup" : "How should voters participate?"}
                  </h2>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {eventType === "ticketing"
                      ? "Configure ticketing rules and access for your attendees."
                      : "Choose whether this is a free public poll or a paid ballot using Mobile Money & Cards."}
                  </p>
                </div>

                {eventType === "ticketing" && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-sm text-amber-950 dark:text-amber-100">
                      <span>🎟️</span> Standalone Event Ticketing
                    </div>
                    <p className="leading-relaxed">
                      This event is set up purely for selling tickets and issuing memorable <strong>CODE PAX</strong> gate passes. You will configure ticket tiers (e.g. Early Bird, Regular, VIP, Table of 4), prices, and gate check-in right in the <strong>🎟️ Tickets</strong> tab of your Event Studio!
                    </p>
                  </div>
                )}

                {/* Handcrafted Mode Selector Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Free Voting */}
                  <button
                    type="button"
                    aria-pressed={votingMode === "free"}
                    onClick={() => {
                      setVotingMode("free");
                      setStepError(null);
                    }}
                    className={`w-full text-left relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 select-none ${
                      votingMode === "free"
                        ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs dark:border-emerald-500 dark:bg-emerald-950/30 dark:ring-emerald-500"
                        : "border-stone-200 bg-stone-50/30 hover:border-stone-300 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#141b16]/40 dark:hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800/10 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300 font-bold">
                        <Icon name="vote" size={20} />
                      </span>
                      {votingMode === "free" ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-800 text-white text-xs font-bold shadow-xs dark:bg-emerald-600">
                          <Icon name="check" size={14} />
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500">Free</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Free Public Ballot</h3>
                      <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100/80 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded">
                        0 FEES
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                      Voters pay nothing. Enforce fairness through phone SMS verification, secret VIP passcodes, or campus rosters.
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-400">
                      <span>✦ SMS / WHATSAPP / VIP VOUCHERS</span>
                    </div>
                  </button>

                  {/* Paid Voting */}
                  <button
                    type="button"
                    aria-pressed={votingMode === "paid"}
                    onClick={() => {
                      setVotingMode("paid");
                      setStepError(null);
                    }}
                    className={`w-full text-left relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 select-none ${
                      votingMode === "paid"
                        ? "border-amber-600 bg-amber-950/5 ring-1 ring-amber-600 shadow-xs dark:border-amber-500 dark:bg-amber-950/30 dark:ring-amber-500"
                        : "border-stone-200 bg-stone-50/30 hover:border-stone-300 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#141b16]/40 dark:hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300 font-bold font-serif text-lg">
                        ₵
                      </span>
                      {votingMode === "paid" ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-white text-xs font-bold shadow-xs dark:bg-amber-500">
                          <Icon name="check" size={14} />
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500">Paid</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Paid Voting</h3>
                      <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100/80 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded">
                        MOMO & CARDS
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                      Voters purchase votes via MTN MoMo, Telecel Cash, AT Money, and Visa/Mastercard. No SMS credits consumed.
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-800 dark:text-amber-400">
                      <span>₵ POWERED BY PAYSTACK GHANA</span>
                    </div>
                  </button>
                </div>

                {/* Sub-config depending on mode */}
                {votingMode === "paid" ? (
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-5 space-y-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between">
                      <label htmlFor="input-price-ghs" className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-200">
                        [ RATE // PRICE PER VOTE ]
                      </label>
                      <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
                        GH₵ {(Number.parseFloat(values.priceGhs) || 0).toFixed(2)} / vote
                      </span>
                    </div>
                    <div className="relative rounded-2xl border border-stone-300 bg-white dark:border-[#223028] dark:bg-[#0c120e] p-2 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/20">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 font-bold text-stone-500 dark:text-stone-400 text-sm">
                        GH₵
                      </span>
                      <input
                        id="input-price-ghs"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={values.priceGhs}
                        onChange={(e) => updateValue("priceGhs", e.target.value)}
                        className="w-full bg-transparent pl-12 pr-4 py-2 font-mono text-base font-bold text-stone-900 focus:outline-none dark:text-stone-100"
                      />
                    </div>
                    {/* Quick Price Chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">POPULAR:</span>
                      {["0.50", "1.00", "2.00", "5.00", "10.00"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateValue("priceGhs", p)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all cursor-pointer ${
                            values.priceGhs === p
                              ? "bg-amber-600 text-white shadow-xs dark:bg-amber-500"
                              : "bg-white border border-stone-200 text-stone-700 hover:border-amber-500 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-300"
                          }`}
                        >
                          GH₵ {p}
                        </button>
                      ))}
                    </div>

                    {/* Minimum Telco / Paystack Transaction Notice */}
                    {(() => {
                      const numP = Number.parseFloat(values.priceGhs) || 0;
                      if (numP > 0 && numP < 1.00) {
                        const minVotes = Math.ceil(1.00 / numP);
                        const minTotal = (minVotes * numP).toFixed(2);
                        return (
                          <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs space-y-1 dark:border-amber-900/50 dark:bg-amber-950/40">
                            <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200">
                              <span>ℹ️</span>
                              <span>Mobile Money Minimum Checkout: GH₵ 1.00</span>
                            </div>
                            <p className="text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                              Paystack and Ghana telcos (MTN MoMo, Telecel Cash, AT Money) enforce a minimum transaction size of <strong>GH₵ 1.00</strong>. At <strong>GH₵ {numP.toFixed(2)}</strong> per vote, voters will be prompted to purchase a minimum package of <strong>{minVotes} votes (GH₵ {minTotal})</strong> at checkout.
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <p className="text-[11px] text-amber-900/80 dark:text-amber-400/80 leading-relaxed font-mono">
                      💡 Payouts: Connect your organization's verified Paystack account in Payments before going live.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-stone-200/90 bg-stone-50/40 p-5 space-y-6 dark:border-[#1c2721] dark:bg-[#141b16]/40">
                    {/* 1. Who is allowed to vote? */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                          1. Who is allowed to vote?
                        </label>
                        <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500">AUDIENCE VERIFICATION</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Option 1: Open to Public */}
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("phone")}
                          className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            verificationMethod === "phone"
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:hover:border-stone-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xl">🌍</span>
                            {verificationMethod === "phone" && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-800 text-white text-[10px] font-bold dark:bg-emerald-600">
                                ✓
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">Open to Public</h4>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug mt-0.5">
                            Ghana phone or WhatsApp OTP verification. 1 ballot per person.
                          </p>
                        </button>

                        {/* Option 2: VIP Passcodes */}
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("invite_code")}
                          className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            verificationMethod === "invite_code"
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:hover:border-stone-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xl">🎟️</span>
                            {verificationMethod === "invite_code" && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-800 text-white text-[10px] font-bold dark:bg-emerald-600">
                                ✓
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">VIP / Delegate Codes</h4>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug mt-0.5">
                            Secret 1-time vouchers (e.g. VIP-8492) distributed to delegates.
                          </p>
                        </button>

                        {/* Option 3: Voter Roll */}
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("voter_list")}
                          className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            verificationMethod === "voter_list"
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:hover:border-stone-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xl">🎓</span>
                            {verificationMethod === "voter_list" && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-800 text-white text-[10px] font-bold dark:bg-emerald-600">
                                ✓
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">Restricted Voter Roll</h4>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug mt-0.5">
                            Student IDs, Index Numbers, or Staff Emails uploaded on a roster.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* 2. Vote Allowance per Person */}
                    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3.5 shadow-2xs dark:border-[#223028] dark:bg-[#0c120e]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                            2. Vote Allowance per Person
                          </h4>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400">How many times each verified voter can participate.</p>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <span>✦</span>
                          <span>{audienceContext[verificationMethod].badge}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Option A: 1 vote per category */}
                        <button
                          type="button"
                          onClick={() => selectAllowanceMode("one_per_category")}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                            allowanceMode === "one_per_category"
                              ? "border-emerald-800 bg-emerald-50/40 ring-1 ring-emerald-800 shadow-2xs dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 dark:border-[#223028] dark:bg-[#0c120e]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                              1 Vote in Every Category <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">(Recommended)</span>
                            </span>
                            <span className="font-mono text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded">
                              Standard Ballot
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                            {audienceContext[verificationMethod].catDesc}
                          </p>
                        </button>

                        {/* Option B: 1 single vote */}
                        <button
                          type="button"
                          onClick={() => selectAllowanceMode("single_choice")}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                            allowanceMode === "single_choice"
                              ? "border-emerald-800 bg-emerald-50/40 ring-1 ring-emerald-800 shadow-2xs dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 dark:border-[#223028] dark:bg-[#0c120e]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">1 Single Vote Across Entire Event</span>
                            <span className="font-mono text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded">
                              Strict Single Choice
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                            {audienceContext[verificationMethod].singleDesc}
                          </p>
                        </button>

                        {/* Option C: Custom limit */}
                        <div
                          onClick={() => selectAllowanceMode("custom_limit")}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            allowanceMode === "custom_limit"
                              ? "border-emerald-800 bg-emerald-50/40 ring-1 ring-emerald-800 shadow-2xs dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 dark:border-[#223028] dark:bg-[#0c120e]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Custom Vote Allowance:</span>
                            <div className="inline-flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-300 dark:border-stone-700">
                              <input
                                type="number"
                                min="2"
                                max="100"
                                value={allowanceMode === "custom_limit" ? values.freeVoteLimit : "3"}
                                onChange={(e) => {
                                  selectAllowanceMode("custom_limit");
                                  updateValue("freeVoteLimit", e.target.value);
                                }}
                                className="w-12 bg-transparent text-center font-bold text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
                              />
                              <span className="text-stone-500 dark:text-stone-400 font-semibold text-[11px]">votes per voter</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                            {audienceContext[verificationMethod].customDesc(allowanceMode === "custom_limit" ? values.freeVoteLimit : "3")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Timing note for VIP Codes */}
                    {verificationMethod === "invite_code" && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs space-y-1 dark:border-amber-900/40 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-bold">
                          <span>🎟️</span>
                          <span>Generate Single-Use VIP Passcodes</span>
                        </div>
                        <p className="text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                          You will be able to generate 50, 100, or custom batches of secret passcodes with a 1-click Excel download in your Event Workspace right after saving.
                        </p>
                      </div>
                    )}

                    {/* Timing note for Voter Roll */}
                    {verificationMethod === "voter_list" && (
                      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs space-y-1 dark:border-sky-900/40 dark:bg-sky-950/30">
                        <div className="flex items-center gap-2 text-sky-950 dark:text-sky-200 font-bold">
                          <span>🎓</span>
                          <span>Import Student / Member Roster</span>
                        </div>
                        <p className="text-[11px] text-sky-900 dark:text-sky-300 leading-relaxed">
                          You will be able to upload your Excel or CSV spreadsheet of Student IDs, Index Numbers, or institutional emails in your Event Workspace right after saving.
                        </p>
                      </div>
                    )}

                    {/* SMS Credit & Phone Channel Transparency */}
                    {verificationMethod === "phone" && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                              💬
                            </span>
                            <div>
                              <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                                {smsBalance === null
                                  ? "SMS Verification Ready"
                                  : smsBalance === 0
                                  ? "0 SMS Credits Remaining"
                                  : `${smsBalance.toLocaleString()} SMS Credits Available`}
                              </p>
                              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                Arkesel SMS OTP delivery for Ghanaian phone numbers
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/organizer/${organizationId}/credits`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-stone-50 shadow-2xs dark:border-[#223028] dark:bg-[#0c120e] dark:text-emerald-300"
                          >
                            Top up SMS Credits →
                          </a>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px]">
                          <div className="rounded-lg bg-white p-2.5 border border-emerald-100 dark:bg-[#0c120e] dark:border-[#223028]">
                            <span className="font-bold text-emerald-950 dark:text-emerald-300 block">💬 WhatsApp: Free</span>
                            <span className="text-stone-500 dark:text-stone-400 leading-snug">
                              Voters are authenticated natively. Uses 0 SMS credits.
                            </span>
                          </div>
                          <div className="rounded-lg bg-white p-2.5 border border-sky-100 dark:bg-[#0c120e] dark:border-[#223028]">
                            <span className="font-bold text-sky-950 dark:text-sky-300 block">✈️ Telegram: Free</span>
                            <span className="text-stone-500 dark:text-stone-400 leading-snug">
                              Native contact verification. Uses 0 SMS credits.
                            </span>
                          </div>
                          <div className="rounded-lg bg-white p-2.5 border border-emerald-100 dark:bg-[#0c120e] dark:border-[#223028]">
                            <span className="font-bold text-stone-900 dark:text-stone-100 block">🌐 Web Phone OTP: 1 Credit</span>
                            <span className="text-stone-500 dark:text-stone-400 leading-snug">
                              Sending a 6-digit SMS OTP consumes 1 SMS credit per voter.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {(step === 3 || (grouped && step === 2)) && (
              <motion.div
                key="step-3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <div className="border-b border-stone-100 pb-4 dark:border-[#1c2721]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">
                      [ 03 // VISIBILITY & NOTICE ]
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Voter Experience
                    </span>
                  </div>
                  <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    Audience instructions & results
                  </h2>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Control when tallies become visible to voters and include any special participation guidelines.
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Results Visibility */}
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 block mb-2">
                      When should voters see live results?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        {
                          val: "organizer_only",
                          label: "Only the Organizer",
                          desc: "Keep all vote counts hidden until you make an announcement.",
                        },
                        {
                          val: "live",
                          label: "Real-time Live Tally",
                          desc: "Voters see current rankings and percentages as votes arrive.",
                        },
                        {
                          val: "after_close",
                          label: "After Voting Closes",
                          desc: "Tallies are revealed automatically once the deadline passes.",
                        },
                        {
                          val: "hidden",
                          label: "Strictly Confidential",
                          desc: "Results are never revealed publicly on the voter portal.",
                        },
                      ].map((item) => (
                        <div
                          key={item.val}
                          onClick={() => updateValue("resultsVisibility", item.val)}
                          className={`cursor-pointer rounded-xl border p-3.5 transition-all select-none ${
                            values.resultsVisibility === item.val
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:hover:border-stone-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{item.label}</span>
                            {values.resultsVisibility === item.val && (
                              <span className="h-2 w-2 rounded-full bg-emerald-800 dark:bg-emerald-400" />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 leading-tight">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extra voter rules */}
                  <div className="rounded-2xl border border-stone-200/90 bg-stone-50/30 p-4 transition-all focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-3 focus-within:ring-emerald-600/10 dark:border-[#1c2721] dark:bg-[#141b16]/30 dark:focus-within:border-emerald-500 dark:focus-within:bg-[#0c120e]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="input-voting-rules" className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                        Voter Notice or Disclaimers <span className="text-stone-400 font-normal">· optional</span>
                      </label>
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
                        [{String(values.votingRules.length).padStart(4, "0")} / 3000]
                      </span>
                    </div>
                    <textarea
                      id="input-voting-rules"
                      rows={3}
                      maxLength={3000}
                      value={values.votingRules}
                      onChange={(e) => updateValue("votingRules", e.target.value)}
                      placeholder="e.g. Only registered students of the Faculty of Engineering may vote in departmental categories. Multiple nominations will be vetted by the committee."
                      className="w-full resize-none bg-transparent text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-stone-100 dark:placeholder:text-stone-600 leading-relaxed"
                    />
                    <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
                      This notice will be pinned at the top of the ballot page for all participants.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step-4"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <div className="border-b border-stone-100 pb-4 dark:border-[#1c2721]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">
                      [ 04 // LAUNCH MANIFEST ]
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Pre-Flight Summary
                    </span>
                  </div>
                  <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    {eventId ? "Review your changes" : "Review your event"}
                  </h2>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    Check your summary below. Once saved, you can add award categories, upload nominee photos, and preview the ballot.
                  </p>
                </div>

                {/* Event Summary Manifest Card */}
                <div className="rounded-2xl border border-stone-200 bg-linear-to-br from-stone-50 to-white p-5 space-y-4 dark:border-[#1c2721] dark:from-[#141b16]/60 dark:to-[#0c120e]">
                  <div className="flex items-start justify-between border-b border-stone-200/80 pb-3 dark:border-[#1c2721]">
                    <div>
                      <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-400">
                        Event Title
                      </span>
                      <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">{values.name || "Untitled Event"}</h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-[11px] font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                      DRAFT
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500 uppercase">Voting Mode</span>
                      <p className="font-semibold text-stone-800 dark:text-stone-200">
                        {votingMode === "paid" ? `Paid · GH₵ ${values.priceGhs}/vote` : "Free Public Ballot"}
                      </p>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500 uppercase">Audience</span>
                      <p className="font-semibold text-stone-800 dark:text-stone-200 capitalize">
                        {votingMode === "paid" ? "Paystack MoMo / Card" : audienceContext[verificationMethod].label}
                      </p>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500 uppercase">Vote Allowance</span>
                      <p className="font-semibold text-stone-800 dark:text-stone-200">
                        {votingMode === "paid"
                          ? "Pay-as-you-go"
                          : allowanceMode === "one_per_category"
                          ? "1 vote in every category"
                          : allowanceMode === "single_choice"
                          ? "1 single vote total"
                          : `${values.freeVoteLimit} votes per voter`}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-3 pt-2 border-t border-stone-100 dark:border-[#1c2721]">
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500 uppercase">Scheduled Window (GMT)</span>
                      <p className="font-mono text-stone-700 dark:text-stone-300 text-xs">
                        {values.startsAt ? new Date(values.startsAt).toLocaleString("en-GH") : "Not set"} →{" "}
                        {values.endsAt ? new Date(values.endsAt).toLocaleString("en-GH") : "Not set"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* What happens next note */}
                <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/50 p-4 text-xs text-stone-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-stone-300 flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-bold text-xs dark:bg-emerald-600">
                    <Icon name="check" size={15} />
                  </div>
                  <div>
                    <strong className="text-stone-900 dark:text-stone-100 font-semibold">What happens next?</strong>
                    <p className="mt-0.5 text-stone-600 dark:text-stone-400 text-xs leading-relaxed">
                      Saving this event creates your competition draft. In your workspace, you will add award categories, upload nominee photos, preview the voter experience, and submit for platform review before going live.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </FormStepPresence>

          {/* Validation Error Banner */}
          {stepError && (
            <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 flex items-center gap-2">
              <Icon name="alert" size={15} />
              <span>{stepError}</span>
            </div>
          )}

          {/* Server Action Result Message */}
          {(dirty || state?.message || pending) && <div className="mt-5"><EventSaveFeedback dirty={dirty} pending={pending} state={state} announce={false} /></div>}

          {/* Saves for the guided workspace are triggered by its shared footer. */}
          {(!setup) && <div className="sticky bottom-3 z-10 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white/95 p-3 shadow-lg shadow-stone-900/5 backdrop-blur-sm transition-colors dark:border-[#1c2721] dark:bg-[#0c120e]/95 sm:p-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-all active:scale-95 cursor-pointer min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#223028] dark:bg-[#141b16] dark:text-stone-300 dark:hover:bg-[#1c2721]"
              >
                <Icon name="arrowLeft" size={14} /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 && !creationFlow ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer ml-auto min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-800 dark:hover:bg-emerald-700"
              >
                Continue <Icon name="arrowRight" size={14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer ml-auto min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-800 dark:hover:bg-emerald-700"
              >
                {pending ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Saving Event...</span>
                  </>
                ) : eventId ? (
                  <>
                    <Icon name="check" size={15} />
                    <span>Save event</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" size={15} />
                    <span>{creationFlow ? "Save & Continue" : "Create event"}</span>
                  </>
                )}
              </button>
            )}
          </div>}
        </div>
      </form>
    </div>
  );
}
