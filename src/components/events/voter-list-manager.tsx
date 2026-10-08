"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

async function hash(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

type VoterRow = {
  id: string;
  identifier_type: string;
  label: string | null;
  max_votes: number;
  used_votes: number;
  redeemed_at: string | null;
};

export function VoterListManager({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<VoterRow[]>([]);
  const [text, setText] = useState("");
  const [defaultVotes, setDefaultVotes] = useState("1");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await createClient()
      .from("event_voter_list_entries")
      .select("id, identifier_type, label, max_votes, used_votes, redeemed_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? "");
      setText((prev) => (prev ? `${prev}\n${content}` : content));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  async function importRows() {
    setBusy(true);
    setMessage("");
    try {
      const values = text
        .split(/[\n,;]+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 2);

      if (!values.length) {
        setMessage("Please paste at least one valid email address or phone number.");
        setBusy(false);
        return;
      }

      const voteCap = Math.max(1, Math.min(100, Number(defaultVotes) || 1));
      const entries = [];
      for (const v of values) {
        entries.push({
          event_id: eventId,
          identifier_hash: await hash(v),
          identifier_type: v.includes("@") ? "email" : "phone",
          max_votes: voteCap,
          label: v,
        });
      }

      const { error } = await createClient()
        .from("event_voter_list_entries")
        .upsert(entries, { onConflict: "event_id,identifier_hash" });

      if (error) {
        setMessage(`Import failed: ${error.message}`);
      } else {
        setMessage(`Successfully imported ${entries.length} approved voter${entries.length === 1 ? "" : "s"}.`);
        setText("");
        load();
      }
    } catch {
      setMessage("An unexpected error occurred during import.");
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, value: number) {
    const safeVal = Math.max(1, Math.min(100, value));
    await createClient().from("event_voter_list_entries").update({ max_votes: safeVal }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this voter from the approved roster?")) return;
    await createClient().from("event_voter_list_entries").delete().eq("id", id);
    load();
  }

  function exportCsv() {
    const csv = [
      "identifier_type,label,max_votes,used_votes,redeemed_at",
      ...rows.map((r) =>
        [r.identifier_type, r.label ?? "", r.max_votes, r.used_votes, r.redeemed_at ?? ""]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `voter-roster-${eventId}.csv`;
    a.click();
  }

  const redeemedCount = rows.filter((r) => r.redeemed_at).length;
  const filtered = rows.filter(
    (r) =>
      !search ||
      (r.label && r.label.toLowerCase().includes(search.toLowerCase())) ||
      r.identifier_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h3 className="font-serif font-bold text-base text-stone-900">
            Approved Voter Roster
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Import approved voter emails or phone numbers. Only matching identities can vote.
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs cursor-pointer"
            >
              <Icon name="arrowRight" size={13} className="rotate-90" />
              <span>Export CSV</span>
            </button>
            <span className="rounded-full bg-stone-100 px-3 py-1.5 text-[11px] font-semibold text-stone-700">
              {rows.length} Voters &middot; {redeemedCount} checked-in
            </span>
          </div>
        )}
      </div>

      {/* Import Box */}
      <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Import Eligible Voters
          </span>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              📂 Upload .csv or .txt file
            </button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Paste emails or phone numbers (one per line or comma-separated)&#10;alice@school.edu&#10;0241234567&#10;bob@example.com"
          className="w-full rounded-xl border border-stone-300 bg-white p-3 font-mono text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <label htmlFor="default-votes" className="text-xs font-semibold text-stone-700">
              Votes per voter:
            </label>
            <input
              id="default-votes"
              type="number"
              min="1"
              max="100"
              value={defaultVotes}
              onChange={(e) => setDefaultVotes(e.target.value)}
              className="w-16 rounded-xl border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={importRows}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {busy ? (
              <>
                <Icon name="refresh" size={13} className="animate-spin" />
                <span>Importing &amp; Hashing…</span>
              </>
            ) : (
              <>
                <Icon name="userPlus" size={13} />
                <span>Import to Roster</span>
              </>
            )}
          </button>
        </div>

        {message && (
          <p className="text-xs font-medium text-emerald-800 pt-1" role="status">
            {message}
          </p>
        )}
      </div>

      {/* Roster Search & Table */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Voter Roster ({rows.length})
            </span>
            <input
              type="text"
              placeholder="Filter roster..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-stone-300 bg-white px-3 py-1 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/90 overflow-hidden max-h-96 overflow-y-auto">
            {filtered.map((r) => {
              const isCheckedIn = Boolean(r.redeemed_at);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 hover:bg-stone-50/60 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isCheckedIn ? "bg-emerald-500" : "bg-stone-300"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-stone-900 block truncate">
                        {r.label ?? "Anonymous entry"}
                      </span>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                        {r.identifier_type} &middot; {r.used_votes}/{r.max_votes} votes used {isCheckedIn ? "· Checked in" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-stone-400">Max:</span>
                      <input
                        aria-label="Maximum votes"
                        type="number"
                        min="1"
                        max="100"
                        defaultValue={r.max_votes}
                        onBlur={(e) => update(r.id, Number(e.target.value))}
                        className="w-12 rounded-lg border border-stone-200 bg-white px-1.5 py-0.5 text-center text-xs font-semibold text-stone-800"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
