"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createTicketTierAction,
  deleteTicketTierAction,
  updateTicketVenueAction,
  getEventAttendeesAction,
  type ActionState,
  type AttendeeRecord,
} from "@/lib/tickets/actions";
import type { TicketTier } from "@/lib/tickets/types";
import { Icon } from "@/components/icon";

export function TicketTiersManager({
  eventId,
  organizationId,
  initialTiers = [],
  venueName = "",
  venueAddress = "",
  doorsOpenTime = "",
}: {
  eventId: string;
  organizationId?: string;
  initialTiers: TicketTier[];
  venueName?: string | null;
  venueAddress?: string | null;
  doorsOpenTime?: string | null;
}) {
  const [tiers, setTiers] = useState<TicketTier[]>(initialTiers);
  const [showAddModal, setShowAddModal] = useState(false);

  // Attendee Guest List state
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingAttendees(true);
    getEventAttendeesAction(eventId)
      .then((data) => {
        if (active) setAttendees(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingAttendees(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  const filteredAttendees = attendees.filter((att) => {
    if (!attendeeSearch.trim()) return true;
    const q = attendeeSearch.toLowerCase();
    return (
      att.customer_name.toLowerCase().includes(q) ||
      att.customer_phone.includes(q) ||
      att.pax_code.toLowerCase().includes(q) ||
      att.tier_name.toLowerCase().includes(q)
    );
  });

  // New tier form state
  const [name, setName] = useState("");
  const [priceGhs, setPriceGhs] = useState("");
  const [capacity, setCapacity] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Venue form state
  const [venue, setVenue] = useState(venueName ?? "");
  const [address, setAddress] = useState(venueAddress ?? "");
  const [doorsTime, setDoorsTime] = useState(doorsOpenTime ?? "");
  const [venueSaved, setVenueSaved] = useState(false);

  async function handleAddTier(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("eventId", eventId);
    formData.append("name", name.trim());
    formData.append("priceGhs", priceGhs.trim());
    formData.append("capacity", capacity.trim());

    try {
      const res: ActionState = await createTicketTierAction({}, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setName("");
        setPriceGhs("");
        setCapacity("100");
        setShowAddModal(false);
        // Refresh local tier representation
        setTiers((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            event_id: eventId,
            name: name.trim(),
            price_minor: Math.round(parseFloat(priceGhs) * 100),
            capacity: parseInt(capacity, 10),
            sold_count: 0,
            is_active: true,
            sort_order: prev.length,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tier.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(tierId: string) {
    if (!confirm("Are you sure you want to remove this ticket tier?")) return;
    try {
      const res = await deleteTicketTierAction(tierId, eventId);
      if (res.error) {
        alert(res.error);
      } else {
        setTiers((prev) => prev.filter((t) => t.id !== tierId));
      }
    } catch {
      alert("Error deleting ticket tier.");
    }
  }

  async function handleSaveVenue(e: React.FormEvent) {
    e.preventDefault();
    setVenueSaved(false);

    const formData = new FormData();
    formData.append("eventId", eventId);
    formData.append("venueName", venue);
    formData.append("venueAddress", address);
    formData.append("doorsOpenTime", doorsTime);

    const res = await updateTicketVenueAction({}, formData);
    if (!res.error) {
      setVenueSaved(true);
      setTimeout(() => setVenueSaved(false), 3000);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Venue & Timing Card */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#070a08]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Venue &amp; Gate Timing
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Where and when ticket holders should arrive.
            </p>
          </div>
          {venueSaved && (
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              ✓ Saved!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveVenue} className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Venue Name
            </label>
            <input
              type="text"
              placeholder="e.g. National Theatre"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs text-stone-900 focus:border-emerald-600 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Location / Landmark
            </label>
            <input
              type="text"
              placeholder="e.g. South Liberia Road, Accra"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs text-stone-900 focus:border-emerald-600 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Doors Open At
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 6:00 PM"
                value={doorsTime}
                onChange={(e) => setDoorsTime(e.target.value)}
                className="mt-1 min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-xs text-stone-900 focus:border-emerald-600 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
              />
              <button
                type="submit"
                className="mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-4 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 2. Ticket Tiers List Card */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#070a08]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4 dark:border-[#1c2721]">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Ticket Tiers &amp; Pricing
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Define Regular, VIP, Table tickets, prices, and quantities.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-900 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-all dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
          >
            <Icon name="sparkle" size={13} />
            <span>+ Add Ticket Tier</span>
          </button>
        </div>

        {/* Existing Tiers Grid */}
        <div className="mt-4">
          {tiers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center dark:border-[#1c2721]">
              <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
                No tickets created yet.
              </p>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                Click &quot;+ Add Ticket Tier&quot; above to add Regular, VIP, or custom passes.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.map((tier) => {
                const sold = tier.sold_count ?? 0;
                const total = tier.capacity ?? 1;
                const pct = Math.min(100, Math.round((sold / total) * 100));

                return (
                  <div
                    key={tier.id}
                    className="flex flex-col justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-[#1c2721] dark:bg-[#0a0d0b]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-stone-900 dark:text-white">
                          {tier.name}
                        </span>
                        <span className="text-xs font-black text-emerald-800 dark:text-emerald-400">
                          GHS {(tier.price_minor / 100).toFixed(2)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                          <span>Sold: {sold} / {total}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                          <div
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-200/80 flex items-center justify-between dark:border-[#1c2721]">
                      <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                        {total - sold} tickets left
                      </span>
                      {sold === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(tier.id)}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 dark:text-red-400 cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. Attendee Guest List & Door Check-In Management */}
      <section className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs dark:border-[#1c2721] dark:bg-[#070a08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4 dark:border-[#1c2721]">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <span>📋</span> Attendee Guest List ({attendees.length})
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Live door list of all issued tickets and gate check-in status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {organizationId && (
              <a
                href={`/api/organizer/${organizationId}/exports/tickets?event=${eventId}`}
                download
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-800 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#111713] dark:text-stone-200 shadow-xs cursor-pointer"
              >
                <span>📥 Export CSV</span>
              </a>
            )}
            <Link
              href="/gate"
              target="_blank"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-xs cursor-pointer"
            >
              <span>📱 Open Scanner ↗</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by attendee name, phone, or CODE PAX..."
            value={attendeeSearch}
            onChange={(e) => setAttendeeSearch(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-stone-200/80 dark:border-[#1c2721]">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:bg-[#0c120e] dark:text-stone-400">
              <tr>
                <th className="px-4 py-3">Attendee</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">CODE PAX</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Gate Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-[#1c2721]">
              {loadingAttendees ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                    Loading guest list...
                  </td>
                </tr>
              ) : filteredAttendees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                    {attendeeSearch ? "No attendees matching your search." : "No tickets issued yet. Once tickets are ordered, they appear here."}
                  </td>
                </tr>
              ) : (
                filteredAttendees.map((att) => (
                  <tr key={att.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-900/30">
                    <td className="px-4 py-3">
                      <div className="font-bold text-stone-900 dark:text-white">{att.customer_name}</div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">{att.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">
                      {att.tier_name}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      #{att.pax_code}
                    </td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                      {att.quantity}
                    </td>
                    <td className="px-4 py-3">
                      {att.status === "checked_in" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          ✓ Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                          Pending Entry
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Add Tier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-[#1c2721] dark:bg-[#070a08]">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-[#1c2721]">
              <h4 className="text-base font-bold text-stone-900 dark:text-white">
                Create Ticket Tier
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTier} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Ticket Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular or VIP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:border-emerald-600 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Price in GHS *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  placeholder="e.g. 50"
                  value={priceGhs}
                  onChange={(e) => setPriceGhs(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:border-emerald-600 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
                />
                <span className="text-[11px] text-stone-500">Enter 0 for free entry.</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Total Quantity Available *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 100"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:border-emerald-600 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-11 flex-1 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#111713] dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-11 flex-1 rounded-xl bg-emerald-900 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
                >
                  {loading ? "Adding..." : "Add Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
