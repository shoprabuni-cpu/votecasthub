"use client";

import { useState } from "react";
import Image from "next/image";
import { approveNominationAction, declineNominationAction, type NominationActionState } from "@/lib/nominations/actions";
import { Icon } from "@/components/icon";

export interface ReviewNomination {
  id: string;
  category_id: string;
  category_name?: string;
  nominee_name: string;
  nominee_phone: string;
  nominee_email: string | null;
  nominee_bio: string | null;
  image_url: string | null;
  portfolio_url: string | null;
  nominator_type: "self" | "third_party";
  nominator_name: string | null;
  nominator_phone: string | null;
  status: "pending" | "approved" | "declined" | "pending_payment";
  created_at: string;
  public_code?: string | null;
}

export function NominationsReviewHub({
  eventId,
  organizationId,
  nominations,
  categories,
}: {
  eventId: string;
  organizationId: string;
  nominations: ReviewNomination[];
  categories: Array<{ id: string; name: string }>;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "declined">("pending");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [actingId, setActingId] = useState<string | null>(null);
  const [customCodes, setCustomCodes] = useState<Record<string, string>>({});
  const [declineReason, setDeclineReason] = useState<string>("");
  const [declineModalId, setDeclineModalId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; success?: boolean; text: string } | null>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const filtered = nominations.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    if (selectedCat !== "all" && item.category_id !== selectedCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.nominee_name.toLowerCase().includes(q) ||
        item.nominee_phone.includes(q) ||
        (item.nominee_email && item.nominee_email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingCount = nominations.filter((n) => n.status === "pending").length;
  const approvedCount = nominations.filter((n) => n.status === "approved").length;
  const declinedCount = nominations.filter((n) => n.status === "declined").length;

  async function handleApprove(id: string) {
    setActingId(id);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("nominationId", id);
      formData.append("eventId", eventId);
      formData.append("organizationId", organizationId);
      if (customCodes[id]?.trim()) {
        formData.append("customCode", customCodes[id].trim());
      }

      const res = await approveNominationAction({} as NominationActionState, formData);
      if (res?.success) {
        setFeedback({ id, success: true, text: res.message || "Nomination approved!" });
      } else {
        setFeedback({ id, success: false, text: res?.error || "Failed to approve nomination." });
      }
    } catch (err) {
      setFeedback({ id, success: false, text: err instanceof Error ? err.message : "Error approving." });
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(id: string) {
    setActingId(id);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("nominationId", id);
      formData.append("eventId", eventId);
      formData.append("organizationId", organizationId);
      if (declineReason.trim()) {
        formData.append("reason", declineReason.trim());
      }

      const res = await declineNominationAction({} as NominationActionState, formData);
      if (res?.success) {
        setFeedback({ id, success: true, text: res.message || "Nomination declined." });
        setDeclineModalId(null);
        setDeclineReason("");
      } else {
        setFeedback({ id, success: false, text: res?.error || "Failed to decline." });
      }
    } catch (err) {
      setFeedback({ id, success: false, text: err instanceof Error ? err.message : "Error declining." });
    } finally {
      setActingId(null);
    }
  }

  function handleExportCsv() {
    if (!nominations.length) return;

    const headers = [
      "Nominee Name",
      "Category",
      "Status",
      "Assigned Voting Code",
      "Nominee Phone",
      "Nominee Email",
      "Nominator Type",
      "Nominator Name",
      "Nominator Phone",
      "Portfolio / Social Link",
      "Bio / Statement",
      "Submitted Date (GMT)",
    ];

    const rows = filtered.map((item) => {
      const catName = categoryMap.get(item.category_id) || item.category_name || "Uncategorized";
      return [
        item.nominee_name,
        catName,
        item.status.toUpperCase(),
        item.public_code || "N/A",
        item.nominee_phone,
        item.nominee_email || "",
        item.nominator_type === "third_party" ? "Third Party" : "Self",
        item.nominator_name || "",
        item.nominator_phone || "",
        item.portfolio_url || "",
        (item.nominee_bio || "").replace(/[\r\n]+/g, " "),
        new Date(item.created_at).toLocaleString("en-GB", { timeZone: "UTC" }),
      ];
    });

    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `votecasthub-nominations-${filter}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top Filter & Counter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4 dark:border-[#1c2721]">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
              filter === "pending"
                ? "bg-amber-100 text-amber-950 font-bold dark:bg-amber-950/60 dark:text-amber-200"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#141b16] dark:text-stone-400"
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("approved")}
            className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
              filter === "approved"
                ? "bg-emerald-100 text-emerald-950 font-bold dark:bg-emerald-950/60 dark:text-emerald-200"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#141b16] dark:text-stone-400"
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("declined")}
            className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
              filter === "declined"
                ? "bg-stone-200 text-stone-900 font-bold dark:bg-stone-800 dark:text-stone-200"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#141b16] dark:text-stone-400"
            }`}
          >
            Declined ({declinedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
              filter === "all"
                ? "bg-stone-900 text-white font-bold dark:bg-stone-100 dark:text-black"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#141b16] dark:text-stone-400"
            }`}
          >
            All ({nominations.length})
          </button>
        </div>

        {/* Category & Search Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 dark:border-[#223028] dark:bg-[#121914] dark:text-stone-300"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search candidate…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 dark:border-[#223028] dark:bg-[#121914] dark:text-white"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={nominations.length === 0}
            title="Download candidate submissions to CSV/Excel"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-[#223028] dark:bg-[#121914] dark:text-stone-300 dark:hover:bg-[#1c2721] cursor-pointer shrink-0 transition-colors"
          >
            <span className="text-sm leading-none">📥</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Nominations List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 p-10 text-center text-xs text-stone-500 dark:border-[#223028]">
          No nominations match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const catName = categoryMap.get(item.category_id) || "Category";
            const isActing = actingId === item.id;
            const itemFeedback = feedback?.id === item.id ? feedback : null;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4 dark:border-[#1c2721] dark:bg-[#0c120e]"
              >
                {/* Header: Photo + Name + Category */}
                <div className="flex items-start gap-3.5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 dark:border-[#223028] dark:bg-[#141b16]">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.nominee_name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-serif text-lg font-bold text-emerald-900 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300">
                        {item.nominee_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {catName}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          item.status === "approved"
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            : item.status === "declined"
                            ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <h4 className="font-serif font-bold text-stone-900 text-base truncate mt-1 dark:text-white">
                      {item.nominee_name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-stone-500 font-mono mt-0.5 dark:text-stone-400">
                      <span>📞 {item.nominee_phone}</span>
                      {item.nominee_email && <span>✉ {item.nominee_email}</span>}
                    </div>
                  </div>
                </div>

                {/* Bio / Reason */}
                {item.nominee_bio && (
                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed bg-stone-50 p-2.5 rounded-xl dark:bg-[#121914] dark:text-stone-300">
                    {item.nominee_bio}
                  </p>
                )}

                {/* Metadata Row: Nominator & Links */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 border-t border-stone-100 pt-3 dark:border-[#1c2721] dark:text-stone-400">
                  <span>
                    {item.nominator_type === "self"
                      ? "👤 Self-Nomination"
                      : `👥 Nominated by: ${item.nominator_name || "Supporter"} (${item.nominator_phone || "N/A"})`}
                  </span>

                  {item.portfolio_url && (
                    <a
                      href={item.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-800 font-bold hover:underline dark:text-emerald-400"
                    >
                      View Portfolio ↗
                    </a>
                  )}
                </div>

                {/* Feedback Toast */}
                {itemFeedback && (
                  <p
                    className={`rounded-xl p-2 text-xs font-semibold ${
                      itemFeedback.success
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {itemFeedback.text}
                  </p>
                )}

                {/* Actions: Approve / Decline */}
                {item.status === "pending" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-[#1c2721]">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Public Code (e.g. MP-01)"
                        value={customCodes[item.id] || ""}
                        onChange={(e) =>
                          setCustomCodes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-full min-h-9 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleApprove(item.id)}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      {isActing ? "Approving…" : "✓ Approve to Ballot"}
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => setDeclineModalId(item.id)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer dark:border-[#223028] dark:bg-[#121914] dark:text-stone-400"
                    >
                      ✕ Decline
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decline Reason Modal */}
      {declineModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4 dark:border-[#1c2721] dark:bg-[#0c120e]">
            <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-white">
              Decline Nomination
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Provide an optional internal reason for declining this candidate:
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Did not meet eligibility criteria or incomplete portfolio..."
              className="w-full rounded-xl border border-stone-200 p-3 text-xs text-stone-900 dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeclineModalId(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 dark:border-[#223028] dark:text-stone-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDecline(declineModalId)}
                className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-800"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
