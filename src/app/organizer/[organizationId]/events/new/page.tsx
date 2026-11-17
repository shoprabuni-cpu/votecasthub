import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventLeaveGuard } from "@/components/events/event-save-feedback";
import { EventDetailsForm } from "@/components/events/event-details-form";
import { CreateTicketEventForm } from "@/components/tickets/create-ticket-event-form";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Create an event — VotecastHub" };
type Props = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<{ type?: string }>;
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NewEventPage({ params, searchParams }: Props) {
  const { organizationId } = await params;
  const resolvedSearchParams = await searchParams;
  const eventType = resolvedSearchParams?.type;

  if (!uuidPattern.test(organizationId)) notFound();
  const { supabase } = await requireVerifiedUser();
  const [{ data: organization, error }, { data: smsBalance }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_sms_balance", { p_org: organizationId }),
  ]);
  if (!organization && !error) notFound();

  return (
    <main className="min-h-screen bg-stone-50/60 pb-16 dark:bg-black">
      <DashboardHeader organizationId={organizationId} />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/organizer/${organizationId}/events`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-emerald-900 dark:hover:text-emerald-400 transition-colors"
          >
            <Icon name="arrowLeft" size={13} />
            <span>Back to {organization?.name ?? "Events"}</span>
          </Link>

          {eventType && (
            <Link
              href={`/organizer/${organizationId}/events/new`}
              className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              ⇄ Switch event type
            </Link>
          )}
        </div>

        {/* Page Title & Intro */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif font-medium text-stone-900 dark:text-white tracking-tight">
            {eventType === "ticketing"
              ? "Create a Ticketed Event"
              : eventType === "voting"
              ? "Create a Voting Contest"
              : "Create an Event"}
          </h1>

          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            {eventType === "ticketing"
              ? "Set up your venue, schedule, and ticket tiers. Attendees can buy tickets via Mobile Money or Card and receive instant PAX pass codes."
              : eventType === "voting"
              ? "Configure your competition schedule, voting model, and categories for public or paid voting."
              : "Select whether you are selling tickets for a live event or running an awards contest with nominees."}
          </p>
        </div>

        {/* Form Container or Error */}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs dark:border-red-900/40 dark:bg-stone-900">
            <h2 className="text-base font-semibold text-stone-900 dark:text-white">
              We could not load this organization.
            </h2>
            <p className="mt-1 text-xs text-stone-500">Please refresh or try again shortly.</p>
          </div>
        ) : eventType === "ticketing" ? (
          <EventLeaveGuard>
            <CreateTicketEventForm organizationId={organizationId} />
          </EventLeaveGuard>
        ) : eventType === "voting" ? (
          <EventLeaveGuard>
            <EventDetailsForm
              creationFlow
              organizationId={organizationId}
              smsBalance={typeof smsBalance === "number" ? smsBalance : null}
            />
          </EventLeaveGuard>
        ) : (
          /* Selection Cards when no type is specified */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <Link
              href={`/organizer/${organizationId}/events/new?type=ticketing`}
              className="group relative flex flex-col justify-between rounded-3xl border-2 border-emerald-500/30 bg-emerald-50/40 p-6 text-left transition-all hover:border-emerald-600 hover:bg-emerald-50/80 hover:shadow-lg dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:hover:border-emerald-500"
            >
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md mb-4 group-hover:scale-105 transition-transform">
                  <span className="text-3xl">🎟️</span>
                </div>
                <h3 className="font-bold text-xl text-stone-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-emerald-400">
                  Ticketed Event
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  For concerts, summits, festivals, parties, conferences & live shows.
                </p>
                <div className="mt-4 rounded-xl bg-white/70 p-3.5 dark:bg-stone-900/70 border border-emerald-100 dark:border-emerald-900/40">
                  <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mb-2 uppercase tracking-wider">
                    Features Included
                  </p>
                  <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Auto-generated PAX pass codes
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Multiple ticket tiers (VIP/Regular)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Live camera gate scanner (/gate)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Instant MoMo checkout & SMS passes
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                <span>Start Ticketed Event Setup</span>
                <span>→</span>
              </div>
            </Link>

            <Link
              href={`/organizer/${organizationId}/events/new?type=voting`}
              className="group relative flex flex-col justify-between rounded-3xl border-2 border-stone-200 bg-stone-50/60 p-6 text-left transition-all hover:border-emerald-600/60 hover:bg-stone-50 hover:shadow-lg dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-emerald-700"
            >
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-800 text-white shadow-md mb-4 group-hover:scale-105 transition-transform">
                  <span className="text-3xl">🗳️</span>
                </div>
                <h3 className="font-bold text-xl text-stone-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-emerald-400">
                  Voting Contest & Awards
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  For pageants, school elections, music awards & competitive polls.
                </p>
                <div className="mt-4 rounded-xl bg-white/70 p-3.5 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800">
                  <p className="text-[11px] font-bold text-stone-800 dark:text-stone-300 mb-2 uppercase tracking-wider">
                    Features Included
                  </p>
                  <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Award categories & nominees
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Free or paid votes (MoMo)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Anti-fraud voting limits
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span> Live standings & leaderboards
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-stone-700 dark:text-stone-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform">
                <span>Start Voting Contest Setup</span>
                <span>→</span>
              </div>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
