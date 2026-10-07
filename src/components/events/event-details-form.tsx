"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createEventAction, updateEventDraftAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { votingRuleOptions, type VotingRule } from "@/lib/voting-rules";
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
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

const STEPS = [
  { id: 1, title: "Identity & Dates", subtitle: "Name & schedule" },
  { id: 2, title: "Voting & Pricing", subtitle: "Free vs. paid model" },
  { id: 3, title: "Rules & Visibility", subtitle: "Audience instructions" },
  { id: 4, title: "Review & Create", subtitle: "Final launch check" },
] as const;

export function EventDetailsForm({
  organizationId,
  eventId,
  initial,
  smsBalance = null,
}: {
  organizationId: string;
  eventId?: string;
  initial?: EventValues;
  smsBalance?: number | null;
}) {
  const action = eventId ? updateEventDraftAction : createEventAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, null);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const [votingMode, setVotingMode] = useState<"free" | "paid">(initial?.votingMode ?? "free");
  const [verificationMethod, setVerificationMethod] = useState<"phone" | "email" | "invite_code" | "voter_list">(
    initial?.verificationMethod ?? "phone"
  );
  const [votingRule, setVotingRule] = useState<VotingRule>(initial?.votingRule ?? "category_limit");

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
    setStepError(null);
    setValues((current) => ({ ...current, [field]: value }));
  };

  // Quick Date Presets
  const applyDatePreset = (preset: "tomorrow" | "7days" | "14days" | "30days") => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0); // 09:00 AM Ghana time

    const end = new Date(start);
    if (preset === "tomorrow") end.setDate(end.getDate() + 3);
    else if (preset === "7days") end.setDate(end.getDate() + 7);
    else if (preset === "14days") end.setDate(end.getDate() + 14);
    else if (preset === "30days") end.setDate(end.getDate() + 30);
    end.setHours(23, 59, 0, 0);

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
      if (new Date(values.startsAt) >= new Date(values.endsAt)) {
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
    <div className="w-full">
      {/* Handcrafted Step Indicator Header */}
      <div className="mb-8 rounded-2xl border border-stone-200/80 bg-white/80 p-3 sm:p-4 shadow-xs backdrop-blur-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isCurrent = step === s.id;
            const isCompleted = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpToStep(s.id)}
                className={`group relative flex items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-200 ${
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
                    {s.title}
                  </p>
                  <p
                    className={`text-[10px] leading-tight truncate hidden md:block ${
                      isCurrent ? "text-emerald-200/90" : "text-stone-400"
                    }`}
                  >
                    {s.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <form action={formAction} className="relative">
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
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step-1"
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
                    Step 1 · Identity & Schedule
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
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 transition-all active:scale-95"
                        >
                          7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDatePreset("14days")}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 transition-all active:scale-95"
                        >
                          14 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDatePreset("30days")}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 transition-all active:scale-95"
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
                    Step 2 · Voting & Monetization
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
                  <div
                    onClick={() => {
                      setVotingMode("free");
                      setStepError(null);
                    }}
                    className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 select-none ${
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
                  </div>

                  {/* Paid Voting */}
                  <div
                    onClick={() => {
                      setVotingMode("paid");
                      setStepError(null);
                    }}
                    className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 select-none ${
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
                  </div>
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
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                            values.priceGhs === p
                              ? "bg-emerald-800 text-white shadow-xs"
                              : "bg-white border border-stone-200 text-stone-700 hover:border-emerald-500"
                          }`}
                        >
                          GH₵ {p}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-amber-900/80 leading-relaxed">
                      💡 <strong>Note on payouts:</strong> You can draft and configure this event immediately. Publishing will require connecting your Paystack account in Organization Settings.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-950/10 bg-emerald-50/30 p-4 space-y-4">
                    {/* Verification Method */}
                    <div>
                      <label htmlFor="input-verification-method" className="block text-xs font-semibold text-stone-800 mb-1.5">
                        How should voters verify identity?
                      </label>
                      <select
                        id="input-verification-method"
                        value={verificationMethod}
                        onChange={(e) =>
                          setVerificationMethod(e.target.value as "phone" | "email" | "invite_code" | "voter_list")
                        }
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-medium text-stone-800 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
                      >
                        <option value="phone">Ghana Phone Number (SMS Code)</option>
                        <option value="email">Email Address (One-time email code)</option>
                        <option value="invite_code">Private Access Code (Shared secretly)</option>
                        <option value="voter_list">Approved Voter List (Upload roster)</option>
                      </select>
                    </div>

                    {/* Voting Rule */}
                    <div>
                      <label htmlFor="input-voting-rule" className="block text-xs font-semibold text-stone-800 mb-1.5">
                        Ballot Fairness Rule
                      </label>
                      <select
                        id="input-voting-rule"
                        value={votingRule}
                        onChange={(e) => {
                          const next = e.target.value as VotingRule;
                          setVotingRule(next);
                          if (next === "one_per_category") updateValue("freeVoteLimit", "1");
                        }}
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-medium text-stone-800 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
                      >
                        {votingRuleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-stone-500">
                        {votingRuleOptions.find((opt) => opt.value === votingRule)?.description}
                      </p>
                    </div>

                    {/* Limit input */}
                    {votingRule !== "one_per_category" && (
                      <div className="flex items-center gap-3">
                        <label htmlFor="input-free-vote-limit" className="text-xs font-medium text-stone-700 whitespace-nowrap">
                          Maximum votes per category:
                        </label>
                        <input
                          id="input-free-vote-limit"
                          type="number"
                          min="1"
                          max="100"
                          value={values.freeVoteLimit}
                          onChange={(e) => updateValue("freeVoteLimit", e.target.value)}
                          className="w-20 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-900 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* SMS Credit callout */}
                    {verificationMethod === "phone" && (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs">
                            ✦
                          </span>
                          <div>
                            <p className="font-semibold text-stone-900">
                              {smsBalance === null
                                ? "SMS verification ready"
                                : `${smsBalance.toLocaleString()} SMS credits available`}
                            </p>
                            <p className="text-[10px] text-stone-500">
                              1 credit is used per Ghanaian voter to send verification codes.
                            </p>
                          </div>
                        </div>
                        <a
                          href={`/organizer/${organizationId}/credits`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-emerald-800 hover:underline"
                        >
                          Top up credits →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {step === 3 && (
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
                    Step 3 · Guidelines & Visibility
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
                    Step 4 · Review & Launch
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
                      Draft Mode
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
                      <span className="text-[10px] text-stone-400 font-medium">Verification</span>
                      <p className="font-semibold text-stone-800 capitalize">
                        {votingMode === "paid" ? "Paystack MoMo/Card" : verificationMethod.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-medium">Results Visibility</span>
                      <p className="font-semibold text-stone-800 capitalize">
                        {values.resultsVisibility.replace("_", " ")}
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
                <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/40 p-4 text-xs text-stone-700 flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-bold text-xs">
                    <Icon name="sparkle" size={15} />
                  </div>
                  <div>
                    <strong className="text-stone-900 font-semibold">What happens next?</strong>
                    <p className="mt-0.5 text-stone-600 text-xs leading-relaxed">
                      Saving this draft opens the <strong>Event Setup Hub</strong> where you will add your award categories, upload nominee photos (or import an Excel roster), customize your cover banner, and test with voter preview.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation Error Banner */}
          {stepError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 flex items-center gap-2">
              <Icon name="alert" size={15} />
              <span>{stepError}</span>
            </div>
          )}

          {/* Server Action Result Message */}
          {state?.message && (
            <div
              className={`mt-5 rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 ${
                state.success
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-red-200 bg-red-50 text-red-900"
              }`}
              role={state.success ? "status" : "alert"}
            >
              <Icon name={state.success ? "check" : "alert"} size={16} />
              <span>{state.message}</span>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-5">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-all active:scale-95 cursor-pointer"
              >
                <Icon name="arrowLeft" size={14} /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer ml-auto"
              >
                Continue <Icon name="arrowRight" size={14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer ml-auto"
              >
                {pending ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Saving Event...</span>
                  </>
                ) : eventId ? (
                  <>
                    <Icon name="check" size={15} />
                    <span>Save Draft Details</span>
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" size={15} />
                    <span>Create Draft Event →</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
