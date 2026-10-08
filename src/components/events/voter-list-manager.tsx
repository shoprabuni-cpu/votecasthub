"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { parseVoterRoster } from "@/lib/voter-roster";
import { Icon } from "@/components/icon";


type VoterRow = {
  id: string;
  identifier_type: string;
  label: string | null;
  max_votes: number;
  used_votes: number;
  redeemed_at: string | null;
};

export function VoterListManager({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [claimCodes, setClaimCodes] = useState<Array<{ identifier: string; code: string }>>([]);
  const [identifierType, setIdentifierType] = useState("identifier");
  const [rows, setRows] = useState<VoterRow[]>([]);
  const [text, setText] = useState("");
  const [defaultVotes, setDefaultVotes] = useState("1");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("event_voter_list_entries")
      .select("id, identifier_type, label, max_votes, used_votes, redeemed_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    setRows(data ?? []);
  }, [eventId]);

  useEffect(() => {
    let active = true;
    void createClient().from("event_voter_list_entries").select("id, identifier_type, label, max_votes, used_votes, redeemed_at").eq("event_id", eventId).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      else setRows(data ?? []);
    });
    return () => { active = false; };
  }, [eventId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { setMessage("Upload a CSV or TXT file smaller than 2 MB."); return; }
    const reader = new FileReader();
    reader.onerror = () => setMessage("Could not read this file. Please try again.");
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
      const values = parseVoterRoster(text);
      if (!values.length) { setMessage("Enter at least one voter identifier."); return; }
      const voteCap = Number(defaultVotes);
      if (!Number.isInteger(voteCap) || voteCap < 1 || voteCap > 100) { setMessage("Votes per voter must be a whole number from 1 to 100."); return; }
      const { data: imported, error } = await createClient().rpc("import_event_voters", {
        p_event_id: eventId, p_identifiers: values, p_identifier_type: identifierType, p_max_votes: voteCap,
      });
      if (error) {
        setMessage(`Import failed: ${error.message}`);
      } else {
        setClaimCodes(imported?.claims ?? []);
        setMessage(`Successfully imported ${imported?.count} approved voter${imported?.count === 1 ? "" : "s"}.`);
        setText("");
        await load();
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "An unexpected error occurred during import.");
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 100) { setMessage("Enter a whole-number vote limit from 1 to 100."); return; }
    setBusy(true);
    try {
      const { error } = await createClient().rpc("update_event_voter_limit", { p_entry_id: id, p_max_votes: value });
      if (error) setMessage(error.message);
      else { setMessage("Vote limit updated."); await load(); router.refresh(); }
    } catch { setMessage("Could not update this voter. Please try again."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Remove this voter from the approved roster?")) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc("remove_event_voter", { p_entry_id: id });
      if (error) setMessage(error.message);
      else { setMessage("Voter removed."); await load(); router.refresh(); }
    } catch { setMessage("Could not remove this voter. Please try again."); }
    finally { setBusy(false); }
  }

  function downloadClaimCodes() {
    const csv = ["identifier,claim_code", ...claimCodes.map((r) => [r.identifier, r.code].map((v) => `"${v.replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `voter-claim-codes-${eventId}.csv`; a.click(); URL.revokeObjectURL(url);
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
            Import emails, Ghana phone numbers, index numbers, student IDs, or membership IDs.
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

        <div className="space-y-2">
          <label htmlFor={`roster-type-${eventId}`} className="text-xs font-semibold text-stone-700">Identifier type</label>
          <select id={`roster-type-${eventId}`} value={identifierType} disabled={busy} onChange={(e) => setIdentifierType(e.target.value)} className="ml-2 rounded-lg border border-stone-300 bg-white p-2 text-xs">
            <option value="identifier">Index number / student ID / other identifier</option>
            <option value="email">Email address</option>
            <option value="phone">Ghana phone number</option>
          </select>
          <p className="text-xs text-stone-500">Email and phone entries require the matching verified account. Other identifiers require a private claim code and bind to the first verified account that redeems them. Reimporting an unused identifier replaces its claim code. Each account can redeem one entry per event. The roster cap applies across all categories.</p>
          <p className="text-xs text-stone-500">Use one identifier per line or comma-separated values. CSV files can include an identifier, email, phone, index_number, student_id, or label column. Leading zeros are preserved. Import each identifier type separately.</p>
        </div>
        <textarea
          disabled={busy}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="00123456&#10;STU/2026/001&#10;MEMBER-42"
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

      {claimCodes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-xs text-amber-950">Download the private claim codes now and send each voter only their own code. Plain codes are shown only for this import and cannot be recovered. A later import replaces this download.</p>
          <button type="button" onClick={downloadClaimCodes} className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white">Download {claimCodes.length} private claim codes</button>
        </div>
      )}
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
                        disabled={busy}
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
                      disabled={busy || Boolean(r.redeemed_at)}
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
