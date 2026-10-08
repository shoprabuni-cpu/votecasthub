import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { ClosureRequestForm } from "@/components/organizations/closure-request-form";
import { OrganizationEventsList, type EventItem } from "@/components/organizations/organization-events-list";
import type { EventWorkspaceState } from "@/lib/events/organizer-presentation";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Organization events — VotecastHub" };

type Props = { params: Promise<{ organizationId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function OrganizationEventsPage({ params }: Props) {
  const { organizationId } = await params;
  if (!uuidPattern.test(organizationId)) notFound();

  const { supabase, userId } = await requireVerifiedUser();
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", organizationId)
    .maybeSingle();

  if (!orgError && !organization) notFound();

  const [{ data: membership, error: membershipError }, { data: events, error: eventsError }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("get_organization_events", { p_organization_id: organizationId }),
  ]);

  if (!membership && !membershipError) notFound();

  const canCreateEvent = ["owner", "admin", "editor"].includes(membership?.role ?? "");
  const isManager = ["owner", "admin"].includes(membership?.role ?? "");
  const { data: workspaceStates } = await supabase.rpc("get_event_workspace_states", { p_organization_id: organizationId });
  const states = new Map(((workspaceStates ?? []) as EventWorkspaceState[]).map(row => [row.event_id, row]));
  const eventRows = (events ?? []).map((event: EventItem) => ({ ...event, ...states.get(event.id) })) as EventItem[];
  // eslint-disable-next-line react-hooks/purity -- Evaluate voting windows once in this async Server Component.
  const requestTime = Date.now();

  return (
    <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
          >
            <Icon name="arrowLeft" size={14} />
            <span>All Organizations</span>
          </Link>
        </div>

        {/* Workspace Header Strip */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-stone-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">ORGANIZATION WORKSPACE</p>
              <span className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-600 shadow-2xs">
                {membership?.role ?? "member"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl">
              {organization?.name ?? "Your organization"}
            </h1>
            <p className="mt-1 text-xs text-stone-500">
              Manage awards, nominees, categories, publication, and live voter traffic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/organizer/${organizationId}/analytics`}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs transition-all hover:border-emerald-600/30 hover:bg-emerald-50/30 hover:text-emerald-900 active:scale-95"
            >
              <Icon name="sparkle" size={14} className="text-emerald-700" />
              <span>Analytics</span>
            </Link>

            <Link
              href={`/organizer/${organizationId}/payments`}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs transition-all hover:border-amber-500/30 hover:bg-amber-50/30 hover:text-amber-900 active:scale-95"
            >
              <Icon name="coin" size={14} className="text-amber-600" />
              <span>Payouts & Bank</span>
            </Link>

            {isManager && (
              <Link
                href={`/organizer/${organizationId}/team`}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs transition-all hover:bg-stone-50 hover:text-stone-900 active:scale-95"
              >
                <Icon name="users" size={14} className="text-stone-500" />
                <span>Team</span>
              </Link>
            )}

            {canCreateEvent && (
              <Link
                href={`/organizer/${organizationId}/events/new`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-800 active:scale-95"
              >
                <span>Create event</span>
                <span className="text-base leading-none">＋</span>
              </Link>
            )}
          </div>
        </div>

        {/* Error State */}
        {membershipError || eventsError || orgError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="alert" size={20} />
            </div>
            <h2 className="text-base font-bold text-stone-900">We could not load this workspace</h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500">
              An error occurred while fetching the events. Refresh the page or try again shortly.
            </p>
            <Link
              href={`/organizer/${organizationId}/events`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors"
            >
              Try again ↻
            </Link>
          </div>
        ) : (
          <>
            {/* Interactive Events Section */}
            <OrganizationEventsList events={eventRows} organizationId={organizationId} now={requestTime} />

            {/* SMS Credit Banner */}
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/40 p-5 shadow-xs sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Icon name="sparkle" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">SMS credits for free voter verification</h3>
                    <p className="mt-0.5 text-xs text-stone-600">
                      Prepay Ghana OTP verification messages, monitor real-time balance, and protect ballot integrity.
                    </p>
                  </div>
                </div>

                <Link
                  href={`/organizer/${organizationId}/credits`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition-all self-start sm:self-auto"
                >
                  <span>Manage SMS Credits</span>
                  <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            </div>

            {/* Organization Settings / Closure for Admins */}
            {isManager && (
              <div className="border-t border-stone-200 pt-6">
                <ClosureRequestForm organizationId={organizationId} />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
