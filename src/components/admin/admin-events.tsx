"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Icon } from "@/components/icon";

type EventRow = {
  id: string;
  name: string;
  status: string;
  voting_mode: string;
  organization_name: string;
  starts_at: string;
  ends_at: string;
};

export function AdminEvents({ events }: { events: EventRow[] }) {
  const [rows, setRows] = useState(events);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<EventRow | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function moderate(id: string, action: string, body: Record<string, string>, nextStatus: string) {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${action}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...body }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to update this event. Please try again.");
      setRows(previous => previous.map(event => event.id === id ? { ...event, status: nextStatus } : event));
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to update this event. Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function approve(id: string) { await moderate(id, "approve", {}, "published"); }
  async function change(id: string, status: string) { await moderate(id, "status", { status }, status); }
  async function reject() {
    if (!rejecting || reason.trim().length < 5) return;
    if (await moderate(rejecting.id, "reject", { reason }, "draft")) {
      setRejecting(null);
      setReason("");
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((e) => {
      const matchSearch =
        search.trim() === "" ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.organization_name.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || e.status === filter;
      return matchSearch && matchFilter;
    });
  }, [rows, filter, search]);

  const statusStyles: Record<string, string> = {
    pending_review: "bg-amber-50 text-amber-900 border-amber-200",
    published: "bg-emerald-50 text-emerald-900 border-emerald-200",
    paused: "bg-yellow-50 text-yellow-900 border-yellow-200",
    closed: "bg-stone-100 text-stone-700 border-stone-200",
    archived: "bg-stone-100 text-stone-500 border-stone-200",
    draft: "bg-stone-50 text-stone-600 border-stone-200",
  };

  return (
    <div className="space-y-6">
      {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{message}</p>}
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
            <Icon name="search" size={14} />
          </span>
          <input
            type="text"
            placeholder="Search event or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["all", "pending_review", "published", "paused", "closed", "archived"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                filter === st
                  ? "bg-emerald-900 text-white shadow-xs"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {st === "all" ? "All Events" : st.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {filteredRows.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRows.map((e) => (
            <article
              key={e.id}
              className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-stone-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <span className="text-[11px] font-semibold text-stone-500 truncate max-w-[60%]">
                    {e.organization_name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-700">
                      {e.voting_mode}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        statusStyles[e.status] ?? statusStyles.draft
                      }`}
                    >
                      {e.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>

                <h3 className="mt-3 text-base font-serif font-bold text-stone-900 leading-snug">
                  <Link href={`/admin/events/${e.id}`} className="hover:text-emerald-800 transition-colors">
                    {e.name}
                  </Link>
                </h3>

                <p className="mt-1 text-[11px] text-stone-400 font-mono">
                  {new Date(e.starts_at).toLocaleDateString("en-GH")} →{" "}
                  {new Date(e.ends_at).toLocaleDateString("en-GH")}
                </p>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/events/${e.id}`}
                  className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
                >
                  View Details →
                </Link>

                <div className="flex items-center gap-1.5 ml-auto">
                  {e.status === "pending_review" && (
                    <>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => approve(e.id)}
                        className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-60 transition-all cursor-pointer"
                      >
                        {busy === e.id ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setRejecting(e)}
                        className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 transition-all cursor-pointer"
                      >
                        Return
                      </button>
                    </>
                  )}

                  {e.status === "published" && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => change(e.id, "paused")}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 transition-all cursor-pointer"
                    >
                      Pause
                    </button>
                  )}

                  {e.status === "paused" && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => change(e.id, "published")}
                      className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-60 transition-all cursor-pointer"
                    >
                      Resume
                    </button>
                  )}

                  {e.status !== "archived" && e.status !== "pending_review" && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => change(e.id, "archived")}
                      className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-500 hover:bg-stone-50 disabled:opacity-60 transition-all cursor-pointer"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200/90 bg-white p-12 text-center shadow-xs space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-400">
            <Icon name="vote" size={18} />
          </div>
          <h3 className="text-sm font-semibold text-stone-800">No events found</h3>
          <p className="text-xs text-stone-400">
            No events match your current filter or search criteria.
          </p>
        </div>
      )}

      {/* Return for changes modal */}
      <AppModal
        open={Boolean(rejecting)}
        title="Return event for changes"
        message="Explain what the organizer needs to modify before resubmitting for platform review."
        tone="info"
        confirmLabel="Return event to draft"
        onCancel={() => {
          setRejecting(null);
          setReason("");
        }}
        onConfirm={reject}
      >
        <div className="mt-3">
          {message && <p role="alert" className="mb-3 text-sm text-red-800">{message}</p>}
          <textarea
            className="w-full rounded-xl border border-stone-300 p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            minLength={5}
            maxLength={1000}
            placeholder="e.g. Please clarify nominee bios and ensure dates close in the future..."
          />
        </div>
      </AppModal>
    </div>
  );
}
