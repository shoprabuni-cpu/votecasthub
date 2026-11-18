"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { findPublicTicketsAction, type FoundTicket } from "@/lib/tickets/actions";
import { VisualTicketPass } from "@/components/tickets/visual-ticket-pass";
import { TicketIcon } from "@/components/brand-icons";

export function TicketLookupClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [tickets, setTickets] = useState<FoundTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(searchQuery: string) {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setError("Please enter at least 3 digits of your phone number or your CODE PAX.");
      return;
    }

    setError(null);
    setLoading(true);
    setSearched(true);

    try {
      const results = await findPublicTicketsAction(q);
      setTickets(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search for tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQuery.trim().length >= 3) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  return (
    <div className="space-y-8">
      {/* Search Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3.5 py-1 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <TicketIcon size={14} />
          <span>Self-Service Ticket Retrieval</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
          Find Your Event Passes
        </h1>
        <p className="mx-auto max-w-xl text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
          Lost your SMS or need to reprint your gate pass? Enter your <strong>Ghana phone number</strong> (e.g. <code>0244123456</code>) or your <strong>CODE PAX</strong> (e.g. <code>PAX-1024</code>) below.
        </p>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch(query);
        }}
        className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-2 shadow-sm dark:border-[#1c2721] dark:bg-[#070a08]"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter phone number or CODE PAX (e.g. PAX-1024)..."
            className="min-h-12 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-[#1c2721] dark:bg-[#030504] dark:text-white dark:placeholder:text-stone-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-12 rounded-xl bg-emerald-800 px-6 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
          >
            {loading ? "Searching..." : "Retrieve Ticket"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-6 pt-4">
          {tickets.length > 0 ? (
            <div className="space-y-8">
              <div className="text-center">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300">
                  Found {tickets.length} matching pass{tickets.length === 1 ? "" : "es"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-center">
                {tickets.map((t) => (
                  <div key={t.id} className="mx-auto w-full max-w-md">
                    <VisualTicketPass
                      ticket={{
                        pax_code: t.pax_code,
                        customer_name: t.customer_name,
                        tier_name: t.tier_name,
                        event_name: t.event_name,
                        venue_name: t.venue_name,
                        venue_address: t.venue_address,
                        doors_open_time: t.doors_open_time,
                        event_image_url: t.imageUrl,
                        quantity: t.quantity,
                        price_minor: 0,
                        order_reference: t.order_reference,
                        status: t.status as "valid" | "checked_in" | "cancelled",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md rounded-3xl border border-dashed border-stone-300 dark:border-[#1c2721] p-8 text-center space-y-3 bg-white dark:bg-[#070a08]">
              <div className="text-3xl">🔍</div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                No active tickets found
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                We couldn&apos;t find any confirmed tickets for <strong>&ldquo;{query}&rdquo;</strong>. Make sure you entered the same phone number used during checkout, or check the event page to buy tickets.
              </p>
              <div className="pt-2">
                <Link
                  href="/events"
                  className="inline-flex min-h-11 items-center rounded-xl bg-stone-100 px-4 text-xs font-bold text-stone-800 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200"
                >
                  Browse Events & Tickets →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
