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
      if (new Date(`${values.endsAt}Z`) <= new Date()) {
        setStepError("Choose a voting closing time in the future.");
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
      {!grouped && <div className="mb-8 rounded-2xl border border-stone-200/80 bg-white/80 p-3 sm:p-4 shadow-xs backdrop-blur-sm">
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
                    ? "bg-emerald-900 text-white shadow-sm ring-1 ring-emerald-800"
                    : isCompleted
                    ? "bg-stone-50 hover:bg-stone-100 text-stone-800"
                    : "text-stone-400 hover:text-stone-600 hover:bg-stone-50/50"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                    isCurrent
                      ? "bg-emerald-700 text-white"
                      : isCompleted
                      ? "bg-emerald-100 text-emerald-800 font-bold"
                      : "bg-stone-200/70 text-stone-500"
                  }`}
                >
                  {isCompleted ? <Icon name="check" size={14} /> : s.id}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-semibold leading-tight truncate ${
                      isCurrent ? "text-white" : isCompleted ? "text-stone-900" : "text-stone-600"
                    }`}
                  >
                    {s.id === 4 && eventId ? "Review & save" : s.title}
                  </p>
                  <p
                    className={`text-[10px] leading-tight truncate hidden md:block ${
                      isCurrent ? "text-emerald-200/90" : "text-stone-400"
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
      {creationFlow && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm font-semibold text-emerald-900">Step 1 of 4 · Event details</p><ol aria-label="Event setup progress" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{["Event details", "Categories & nominees", "Voting settings", "Review & Submit"].map((label, index) => <li key={label} aria-current={index === 0 ? "step" : undefined} className="flex items-start gap-2 text-xs font-semibold leading-5 text-stone-600"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-emerald-900 text-white" : "bg-stone-200 text-stone-600"}`}>{index + 1}</span><span className="pt-1">{label}</span></li>)}</ol></div>}

      <form ref={formRef} action={formAction} onSubmit={event => { if (grouped && (!validateStep(1) || !validateStep(2))) event.preventDefault(); }} className="relative">
        {grouped && <input type="hidden" name="setupFlow" value="guided" />}
        {/* Hidden inputs to guarantee complete formData payload without relying on DOM visibility */}
        <input type="hidden" name="organizationId" value={organizationId} />
        {eventId && <input type="hidden" name="eventId" value={eventId} />}
        <input type="hidden" name="name" value={values.name} />
        <input type="hidden" name="description" value={values.description} />
        <input type="hidden" name="votingMode" value={votingMode} />
        <input type="hidden" name="verificationMethod" value={verificationMethod} />
        <input type="hidden" name="votingRule" value={votingRule} />
        <input type="hidden" name="priceGhs" value={values.priceGhs} />
        <input type="hidden" name="freeVoteLimit" value={values.freeVoteLimit} />
        <input type="hidden" name="votingRules" value={values.votingRules} />
        <input type="hidden" name="resultsVisibility" value={values.resultsVisibility} />
        <input type="hidden" name="startsAt" value={values.startsAt} />
        <input type="hidden" name="endsAt" value={values.endsAt} />

        {/* Step Views */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-8 shadow-xs">
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
                <div>
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Event details
                  </div>
                  <h2 className="mt-1 text-2xl font-serif font-medium text-stone-900 tracking-tight">
                    What are you celebrating?
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Give your event a memorable title, brief context, and set the voting window in Ghana time.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Event Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="input-event-name" className="text-xs font-semibold text-stone-800">
                        Official Event Name <span className="text-emerald-700">*</span>
                      </label>
                      <span className="text-[11px] text-stone-400">{values.name.length}/160</span>
                    </div>
                    <input
                      id="input-event-name"
                      type="text"
                      minLength={2}
                      maxLength={160}
                      value={values.name}
                      onChange={(e) => updateValue("name", e.target.value)}
                      placeholder="e.g. AAMUSTED Student Choice Awards 2026"
                      className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all"
                    />
                    <p className="mt-1 text-[11px] text-stone-500">
                      This will appear prominently on voter certificates, ballot headers, and sharing links.
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="input-event-description" className="text-xs font-semibold text-stone-800">
                        Event Story & Context <span className="text-stone-400 font-normal">· optional</span>
                      </label>
                      <span className="text-[11px] text-stone-400">{values.description.length}/5000</span>
                    </div>
                    <textarea
                      id="input-event-description"
                      rows={3}
                      maxLength={5000}
                      value={values.description}
                      onChange={(e) => updateValue("description", e.target.value)}
                      placeholder="Briefly describe what this awards ceremony or election stands for..."
                      className="w-full rounded-xl border border-stone-300 bg-stone-50/40 p-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all resize-none"
                    />
                  </div>

                  {/* Date Pickers with Ghana Helpers */}
                  <div className="pt-2 border-t border-stone-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-xs font-semibold text-stone-800">Voting Period</span>
                        <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          <Icon name="clock" size={11} /> Ghana Time (GMT)
                        </span>
                      </div>
                      {/* Presets */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[11px] text-stone-400 hidden sm:inline">Quick presets:</span>
                        <button
                          type="button"
                          onClick={() => applyDatePreset("7days")}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-2.5 text-sm font-medium text-stone-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 transition-all active:scale-95 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDatePreset("14days")}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-2.5 text-sm font-medium text-stone-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 transition-all active:scale-95 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          14 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDatePreset("30days")}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-2.5 text-sm font-medium text-stone-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 transition-all active:scale-95 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          30 Days
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label htmlFor="input-starts-at" className="block text-xs font-medium text-stone-700 mb-1">
                          Voting Opens
                        </label>
                        <input
                          id="input-starts-at"
                          type="datetime-local"
                          value={values.startsAt}
                          onChange={(e) => updateValue("startsAt", e.target.value)}
                          className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3 py-2 text-xs font-mono text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="input-ends-at" className="block text-xs font-medium text-stone-700 mb-1">
                          Voting Closes
                        </label>
                        <input
                          id="input-ends-at"
                          type="datetime-local"
                          value={values.endsAt}
                          onChange={(e) => updateValue("endsAt", e.target.value)}
                          className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3 py-2 text-xs font-mono text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all"
                        />
                      </div>
                    </div>
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
                <div>
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Voting settings
                  </div>
                  <h2 className="mt-1 text-2xl font-serif font-medium text-stone-900 tracking-tight">
                    How should voters participate?
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Choose whether this is a free public poll or a paid ballot using Mobile Money & Cards.
                  </p>
                </div>

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
                        ? "border-emerald-800 bg-emerald-950/5 shadow-sm"
                        : "border-stone-200 bg-stone-50/30 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800/10 text-emerald-900 font-bold">
                        <Icon name="vote" size={20} />
                      </span>
                      {votingMode === "free" && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-800 text-white text-xs font-bold shadow-xs">
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-stone-900">Free Voting</h3>
                    <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                      Voters pay nothing. Enforce fairness through phone SMS verification, email passcodes, or private voter lists.
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-800">
                      <span>✦ SMS verification or private lists</span>
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
                        ? "border-emerald-800 bg-emerald-950/5 shadow-sm"
                        : "border-stone-200 bg-stone-50/30 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-900 font-bold font-serif text-lg">
                        ₵
                      </span>
                      {votingMode === "paid" && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-800 text-white text-xs font-bold shadow-xs">
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-stone-900">Paid Voting</h3>
                    <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                      Voters purchase votes via MTN MoMo, Telecel Cash, AT Money, and Visa/Mastercard. No SMS credits used.
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
                      <span>₵ Powered by Paystack Ghana</span>
                    </div>
                  </button>
                </div>

                {/* Sub-config depending on mode */}
                {votingMode === "paid" ? (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="input-price-ghs" className="text-xs font-semibold text-amber-950">
                        Price Per Vote (in Ghana Cedis)
                      </label>
                      <span className="text-[11px] font-medium text-amber-800">
                        GH₵ {(Number.parseFloat(values.priceGhs) || 0).toFixed(2)} per vote
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 font-semibold text-stone-500 text-sm">
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
                        className="w-full rounded-xl border border-stone-300 bg-white pl-12 pr-4 py-2.5 text-sm font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
                      />
                    </div>
                    {/* Quick Price Chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-stone-500">Popular rates:</span>
                      {["0.50", "1.00", "2.00", "5.00", "10.00"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateValue("priceGhs", p)}
                          className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all ${
                            values.priceGhs === p
                              ? "bg-emerald-800 text-white shadow-xs"
                              : "bg-white border border-stone-200 text-stone-700 hover:border-emerald-500"
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
                          <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-950">
                              <span>ℹ️</span>
                              <span>Mobile Money Minimum Checkout: GH₵ 1.00</span>
                            </div>
                            <p className="text-[11px] text-amber-900 leading-relaxed">
                              Paystack and Ghana telcos (MTN MoMo, Telecel Cash, AT Money) have a minimum checkout threshold of <strong>GH₵ 1.00</strong>. At <strong>GH₵ {numP.toFixed(2)}</strong> per vote, voters will be prompted to purchase a minimum package of <strong>{minVotes} votes (GH₵ {minTotal})</strong> at checkout.
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <p className="text-[11px] text-amber-900/80 leading-relaxed">
                      💡 <strong>Note on payouts:</strong> You can set up this event now. Before paid voting goes live, connect your Paystack account in Payments.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/40 p-5 space-y-6">
                    {/* 1. Who is allowed to vote? */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                          1. Who is allowed to vote?
                        </label>
                        <span className="text-[11px] text-stone-400">Select audience verification</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Option 1: Open to Public */}
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("phone")}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            verificationMethod === "phone"
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xl">🌍</span>
                            {verificationMethod === "phone" && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-800 text-white text-[10px] font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900">Open to Public</h4>
                          <p className="text-[11px] text-stone-500 leading-snug mt-0.5">
                            Verified Ghana phone or WhatsApp number. 1 ballot per person.
                          </p>
                        </button>

                        {/* Option 2: VIP Passcodes */}
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("invite_code")}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            verificationMethod === "invite_code"
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xl">🎟️</span>
                            {verificationMethod === "invite_code" && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-800 text-white text-[10px] font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900">VIP / Delegate Codes</h4>
                          <p className="text-[11px] text-stone-500 leading-snug mt-0.5">
                            Secret 1-time vouchers (e.g. VIP-8492) distributed to attendees.
                          </p>
                        </button>

                        {/* Option 3: Voter Roll */}
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("voter_list")}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            verificationMethod === "voter_list"
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xl">🎓</span>
                            {verificationMethod === "voter_list" && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-800 text-white text-[10px] font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900">Restricted Voter Roll</h4>
                          <p className="text-[11px] text-stone-500 leading-snug mt-0.5">
                            Approved Student IDs, Index Numbers, or Staff Emails on a roster.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* 2. Vote Allowance per Person (Contextual to Selected Audience) */}
                    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">2. Vote Allowance per Person</h4>
                          <p className="text-[11px] text-stone-500">How many times each verified voter can participate.</p>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-950">
                          <span>✦</span>
                          <span>{audienceContext[verificationMethod].badge}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Option A: 1 vote per category */}
                        <button
                          type="button"
                          onClick={() => selectAllowanceMode("one_per_category")}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                            allowanceMode === "one_per_category"
                              ? "border-emerald-800 bg-emerald-50/30 ring-1 ring-emerald-800 shadow-2xs"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-900">
                              1 Vote in Every Category <span className="text-emerald-800 font-semibold text-[11px]">(Recommended)</span>
                            </span>
                            <span className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded">Standard Ballot</span>
                          </div>
                          <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                            {audienceContext[verificationMethod].catDesc}
                          </p>
                        </button>

                        {/* Option B: 1 single vote */}
                        <button
                          type="button"
                          onClick={() => selectAllowanceMode("single_choice")}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                            allowanceMode === "single_choice"
                              ? "border-emerald-800 bg-emerald-50/30 ring-1 ring-emerald-800 shadow-2xs"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-900">1 Single Vote Across the Entire Event</span>
                            <span className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded">Strict Single Choice</span>
                          </div>
                          <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                            {audienceContext[verificationMethod].singleDesc}
                          </p>
                        </button>

                        {/* Option C: Custom limit */}
                        <div
                          onClick={() => selectAllowanceMode("custom_limit")}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            allowanceMode === "custom_limit"
                              ? "border-emerald-800 bg-emerald-50/30 ring-1 ring-emerald-800 shadow-2xs"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-stone-900">Custom Vote Allowance:</span>
                            <div className="inline-flex items-center gap-1.5 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-300">
                              <input
                                type="number"
                                min="2"
                                max="100"
                                value={allowanceMode === "custom_limit" ? values.freeVoteLimit : "3"}
                                onChange={(e) => {
                                  selectAllowanceMode("custom_limit");
                                  updateValue("freeVoteLimit", e.target.value);
                                }}
                                className="w-12 bg-transparent text-center font-bold text-xs text-stone-900 focus:outline-none"
                              />
                              <span className="text-stone-500 font-semibold text-[11px]">votes per voter</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                            {audienceContext[verificationMethod].customDesc(allowanceMode === "custom_limit" ? values.freeVoteLimit : "3")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Timing note for VIP Codes */}
                    {verificationMethod === "invite_code" && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs space-y-1">
                        <div className="flex items-center gap-2 text-amber-950 font-bold">
                          <span>🎟️</span>
                          <span>Generate Single-Use VIP Passcodes</span>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          You will be able to generate 50, 100, or custom batches of secret passcodes with a 1-click Excel download in your Event Workspace right after saving.
                        </p>
                      </div>
                    )}

                    {/* Timing note for Voter Roll */}
                    {verificationMethod === "voter_list" && (
                      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs space-y-1">
                        <div className="flex items-center gap-2 text-sky-950 font-bold">
                          <span>🎓</span>
                          <span>Import Student / Member Roster</span>
                        </div>
                        <p className="text-[11px] text-sky-900 leading-relaxed">
                          You will be able to upload your Excel or CSV spreadsheet of Student IDs, Index Numbers, or institutional emails in your Event Workspace right after saving.
                        </p>
                      </div>
                    )}

                    {/* SMS Credit & Phone Channel Transparency */}
                    {verificationMethod === "phone" && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                              💬
                            </span>
                            <div>
                              <p className="text-xs font-bold text-stone-900">
                                {smsBalance === null
                                  ? "SMS Verification Ready"
                                  : smsBalance === 0
                                  ? "0 SMS Credits Remaining"
                                  : `${smsBalance.toLocaleString()} SMS Credits Available`}
                              </p>
                              <p className="text-[11px] text-stone-500">
                                Arkesel SMS OTP delivery for Ghanaian phone numbers
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/organizer/${organizationId}/credits`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-stone-50 shadow-2xs"
                          >
                            Top up SMS Credits →
                          </a>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-200/60 text-[11px]">
                          <div className="rounded-lg bg-white p-2.5 border border-emerald-100">
                            <span className="font-bold text-emerald-950 block">💬 WhatsApp Voting: Free</span>
                            <span className="text-stone-500 leading-snug">
                              Voters are authenticated natively by WhatsApp. Uses 0 SMS credits.
                            </span>
                          </div>
                          <div className="rounded-lg bg-white p-2.5 border border-emerald-100">
                            <span className="font-bold text-stone-900 block">🌐 Web Phone OTP: 1 Credit</span>
                            <span className="text-stone-500 leading-snug">
                              Sending a 6-digit SMS code to web voters consumes 1 SMS credit per ballot.
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
                <div>
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Results & voter instructions
                  </div>
                  <h2 className="mt-1 text-2xl font-serif font-medium text-stone-900 tracking-tight">
                    Audience instructions & results
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Control when tallies become visible to voters and include any special participation notes.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Results Visibility */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-800 mb-2">
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
                              ? "border-emerald-800 bg-emerald-950/5 ring-1 ring-emerald-800 shadow-xs"
                              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-900">{item.label}</span>
                            {values.resultsVisibility === item.val && (
                              <span className="h-2 w-2 rounded-full bg-emerald-800" />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-stone-500 leading-tight">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extra voter rules */}
                  <div className="pt-2 border-t border-stone-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="input-voting-rules" className="text-xs font-semibold text-stone-800">
                        Voter Notice or Disclaimers <span className="text-stone-400 font-normal">· optional</span>
                      </label>
                      <span className="text-[11px] text-stone-400">{values.votingRules.length}/3000</span>
                    </div>
                    <textarea
                      id="input-voting-rules"
                      rows={4}
                      maxLength={3000}
                      value={values.votingRules}
                      onChange={(e) => updateValue("votingRules", e.target.value)}
                      placeholder="e.g. Only registered students of the Faculty of Engineering may vote in departmental categories. Multiple nominations will be vetted by the committee."
                      className="w-full rounded-xl border border-stone-300 bg-stone-50/40 p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all resize-none"
                    />
                    <p className="mt-1 text-[11px] text-stone-400">
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
                <div>
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    {eventId ? "Review your changes" : "Review your event"}
                  </div>
                  <h2 className="mt-1 text-2xl font-serif font-medium text-stone-900 tracking-tight">
                    Ready to set up your event workspace
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Check your summary below. Once saved, you can add award categories, upload nominee photos, and preview the ballot.
                  </p>
                </div>

                {/* Event Summary Manifest Card */}
                <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-5 space-y-4">
                  <div className="flex items-start justify-between border-b border-stone-200/80 pb-3">
                    <div>
                      <span className="text-[10px] font-semibold tracking-wider text-emerald-800 uppercase">
                        Event Title
                      </span>
                      <h3 className="text-lg font-serif font-bold text-stone-900">{values.name || "Untitled Event"}</h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                      Not published yet
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-stone-400 font-medium">Voting Mode</span>
                      <p className="font-semibold text-stone-800">
                        {votingMode === "paid" ? `Paid · GH₵ ${values.priceGhs}/vote` : "Free Voting"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-medium">Audience</span>
                      <p className="font-semibold text-stone-800 capitalize">
                        {votingMode === "paid" ? "Paystack MoMo / Card" : audienceContext[verificationMethod].label}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-medium">Vote Allowance</span>
                      <p className="font-semibold text-stone-800">
                        {votingMode === "paid"
                          ? "Pay-as-you-go"
                          : allowanceMode === "one_per_category"
                          ? "1 vote in every category"
                          : allowanceMode === "single_choice"
                          ? "1 single vote total"
                          : `${values.freeVoteLimit} votes per voter`}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-3 pt-2 border-t border-stone-100">
                      <span className="text-[10px] text-stone-400 font-medium">Scheduled Window</span>
                      <p className="font-mono text-stone-700 text-xs">
                        {values.startsAt ? new Date(values.startsAt).toLocaleString("en-GH") : "Not set"} →{" "}
                        {values.endsAt ? new Date(values.endsAt).toLocaleString("en-GH") : "Not set"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* What happens next note */}
                <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/50 p-4 text-xs text-stone-700 flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-bold text-xs">
                    <Icon name="check" size={15} />
                  </div>
                  <div>
                    <strong className="text-stone-900 font-semibold">What happens next?</strong>
                    <p className="mt-0.5 text-stone-600 text-xs leading-relaxed">
                      Saving this event creates your competition draft. In your workspace, you will add award categories, upload nominee photos, preview the voter experience, and submit for platform review before going live.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </FormStepPresence>

          {/* Validation Error Banner */}
          {stepError && (
            <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 flex items-center gap-2">
              <Icon name="alert" size={15} />
              <span>{stepError}</span>
            </div>
          )}

          {/* Server Action Result Message */}
          {(dirty || state?.message || pending) && <div className="mt-5"><EventSaveFeedback dirty={dirty} pending={pending} state={state} announce={false} /></div>}

          {/* Saves for the guided workspace are triggered by its shared footer. */}
          {(!setup) && <div className="sticky bottom-3 z-10 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-lg shadow-stone-900/5 backdrop-blur-sm sm:p-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-all active:scale-95 cursor-pointer min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer ml-auto min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue <Icon name="arrowRight" size={14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer ml-auto min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
