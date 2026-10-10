"use client";

import { useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import type { EventNextStep } from "@/lib/events/next-step";
import { EventLeaveGuard } from "./event-save-feedback";

const sections = [{ id: "details", label: "Event details" }, { id: "nominees", label: "Categories & nominees" }, { id: "voting", label: "Voting settings" }] as const;
type Section = typeof sections[number]["id"];

export function EventWorkspace({ details, nominees, voting, editor, canEdit, canManageVoting, viewLink, nextStep, progress }: {
  details: ReactNode; nominees: ReactNode; voting: ReactNode; editor: ReactNode; canEdit: boolean; canManageVoting: boolean; viewLink: ReactNode;
  nextStep?: EventNextStep; progress?: { completed: number; total: number };
}) {
  const [section, setSection] = useState<Section>("details");
  const [editing, setEditing] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % sections.length : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + sections.length - 1) % sections.length : event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSection(sections[next].id); buttons.current[next]?.focus();
  }
  return <EventLeaveGuard><div className="space-y-5" onClick={event => {
    const trigger = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-workspace-section]");
    const target = sections.find(item => item.id === trigger?.dataset.workspaceSection);
    if (!target) return;
    setSection(target.id);
    if (trigger?.dataset.workspaceEditor === "true") setEditing(true);
    buttons.current[sections.findIndex(item => item.id === target.id)]?.focus();
  }}>
    {nextStep && <section aria-labelledby="event-next-step" className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 via-white to-stone-50 p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-900 text-white"><Icon name={progress ? "check" : "sparkle"} size={20} /></span><div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">{progress ? "Your next step" : "Good to know"}</p><h2 id="event-next-step" className="text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">{nextStep.title}</h2><p className="mt-1 max-w-xl text-sm leading-6 text-stone-600">{nextStep.description}</p></div></div>
        {nextStep.href ? <Link href={nextStep.href} onClick={event => { if (nextStep.href === "#share-event") { event.preventDefault(); setSection("details"); window.requestAnimationFrame(() => document.getElementById("share-event")?.scrollIntoView({ block: "start" })); } }} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{nextStep.label}<Icon name="arrowRight" size={16} /></Link> : <button type="button" data-workspace-section={nextStep.section} data-workspace-editor={nextStep.editor ? "true" : "false"} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">{nextStep.label}<Icon name="arrowRight" size={16} /></button>}
      </div>
      {progress && <div className="mt-5 border-t border-emerald-100 pt-4"><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs font-medium text-stone-600"><span>Required setup</span><span>{progress.completed} of {progress.total} complete</span></div><progress aria-label="Required event setup" value={progress.completed} max={progress.total} className="block h-2 w-full overflow-hidden rounded-full bg-emerald-100 accent-emerald-700 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-emerald-700 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-emerald-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-emerald-700" /><p className="mt-2 text-xs text-stone-500">Cover image and description are optional.</p></div>}
    </section>}
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && <button type="button" aria-expanded={editing} aria-controls="workspace-editor" onClick={() => { setSection("details"); setEditing(true); }} className="min-h-11 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Edit event</button>}
      {canManageVoting && <button type="button" onClick={() => setSection("voting")} className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Manage voting</button>}
      {viewLink}
    </div>
    <div role="tablist" aria-label="Event workspace" className="grid grid-cols-1 gap-1 rounded-2xl border border-stone-200/70 bg-stone-100/80 p-1.5 sm:grid-cols-3">
      {sections.map((item, index) => <button key={item.id} ref={element => { buttons.current[index] = element; }} id={`workspace-tab-${item.id}`} type="button" role="tab" aria-selected={section === item.id} aria-controls={`workspace-${item.id}`} tabIndex={section === item.id ? 0 : -1} onClick={() => setSection(item.id)} onKeyDown={event => navigate(event, index)} className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold ${section === item.id ? "bg-white text-emerald-900 shadow-xs" : "text-stone-600 hover:bg-white/60"}`}>{item.label}</button>)}
    </div>
    <section id="workspace-details" role="tabpanel" aria-labelledby="workspace-tab-details" hidden={section !== "details"} className="space-y-5">
      <div id="workspace-editor" hidden={!editing} className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-stone-900">Edit event</h2><button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100 border border-stone-300 bg-white shadow-xs py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Hide editor</button></div>{editor}</div>
      {details}
    </section>
    <section id="workspace-nominees" role="tabpanel" aria-labelledby="workspace-tab-nominees" hidden={section !== "nominees"} className="space-y-5">{nominees}</section>
    <section id="workspace-voting" role="tabpanel" aria-labelledby="workspace-tab-voting" hidden={section !== "voting"} className="space-y-5">{voting}</section>
  </div></EventLeaveGuard>;
}
