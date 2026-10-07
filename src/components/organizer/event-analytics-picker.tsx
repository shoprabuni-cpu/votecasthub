import Link from "next/link";
import { Icon } from "@/components/icon";

export type AnalyticsEventChoice = {
  id: string;
  slug: string;
  name: string;
  status: string;
  voting_mode: string;
  starts_at: string;
  ends_at: string;
};

export function EventAnalyticsPicker({
  events,
  organizationId,
}: {
  events: AnalyticsEventChoice[];
  organizationId: string;
}) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-900 shadow-xs">
        <Icon name="sparkle" size={28} />
      </div>

      <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1 text-[11px] font-semibold text-emerald-900 uppercase tracking-wider">
        <span>Analytics Command Center</span>
      </div>

      <h1 className="mt-3 font-serif text-3xl sm:text-5xl font-bold tracking-tight text-stone-900">
        Every ballot tells a story.
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-500 leading-relaxed">
        Select an event to inspect live turnout, leader standings, conversion metrics, and revenue breakdown.
      </p>

      {events.length > 0 ? (
        <div className="mx-auto mt-10 max-w-lg text-left">
          <form method="get" className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
            <label className="block text-xs font-semibold text-stone-800" htmlFor="choose-analytics-event">
              Select an Event to Analyze
            </label>
            <input type="hidden" name="range" value="all" />

            <select
              required
              defaultValue=""
              name="event"
              id="choose-analytics-event"
              className="w-full rounded-2xl border border-stone-300 bg-stone-50/50 px-4 py-3 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
            >
              <option value="" disabled>
                Choose an event from your organization...
              </option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {event.status.replaceAll("_", " ")} ({event.voting_mode})
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-900 px-5 py-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer"
            >
              Launch Analytics Dashboard →
            </button>
          </form>

          {/* Quick links to active events */}
          <div className="mt-6 space-y-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block text-center">
              Or pick directly:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {events.slice(0, 4).map((e) => (
                <Link
                  key={e.id}
                  href={`?event=${encodeURIComponent(e.id)}&range=all`}
                  className="rounded-xl border border-stone-200 bg-white p-3 text-xs hover:border-emerald-600 hover:shadow-2xs transition-all flex items-center justify-between"
                >
                  <span className="font-semibold text-stone-900 truncate">{e.name}</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 shrink-0 ml-2">
                    {e.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-stone-50/50 p-10 text-center">
          <p className="text-sm text-stone-600">You haven’t created any events in this workspace yet.</p>
          <Link
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all"
            href={`/organizer/${organizationId}/events/new`}
          >
            <Icon name="sparkle" size={13} />
            <span>Create Your First Event</span>
          </Link>
        </div>
      )}
    </section>
  );
}
