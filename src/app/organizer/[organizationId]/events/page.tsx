import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { ClosureRequestForm } from "@/components/organizations/closure-request-form";
import { OrganizationEventsList, type EventItem } from "@/components/organizations/organization-events-list";
import type { EventWorkspaceState } from "@/lib/events/organizer-presentation";
import { Icon } from "@/components/icon";
import { CreateEventModal } from "@/components/events/create-event-modal";

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

  const [
    { data: membership, error: membershipError },
    { data: events, error: eventsError },
  ] = await Promise.all([
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
  const eventIds = (events ?? []).map((e: any) => e.id);

  const [
    { data: workspaceStates },
    { data: eventMetas },
    { data: ticketTiersData },
    { data: categoriesData },
  ] = await Promise.all([
    supabase.rpc("get_event_workspace_states", { p_organization_id: organizationId }),
    eventIds.length
      ? supabase.from("events").select("id, event_type, venue_name, doors_open_time, image_path").in("id", eventIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("event_ticket_tiers").select("event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("categories").select("event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const states = new Map(((workspaceStates ?? []) as EventWorkspaceState[]).map((row) => [row.event_id, row]));
  const typeMap = new Map((eventMetas ?? []).map((row) => [row.id, row]));
  const ticketEventIdSet = new Set((ticketTiersData ?? []).map((t: any) => t.event_id));
  const categoryEventIdSet = new Set((categoriesData ?? []).map((c: any) => c.event_id));

  // Resolve signed URLs for event cover images
  const imagePaths = [...new Set((eventMetas ?? []).map((m: any) => m.image_path).filter(Boolean))] as string[];
  const { data: signedImages } = imagePaths.length
    ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600)
    : { data: [] };
  const imageUrlMap = new Map(
    (signedImages ?? []).flatMap((img) => (img.path && img.signedUrl ? [[img.path, img.signedUrl] as const] : []))
  );

  const eventRows = (events ?? []).map((event: EventItem) => {
    const meta = typeMap.get(event.id);
    const explicitType = meta?.event_type ?? (event as any).event_type;
    const hasTickets = ticketEventIdSet.has(event.id);
    const hasCategories = categoryEventIdSet.has(event.id);

    let resolvedType = explicitType;
    if (explicitType === "ticketing") {
      resolvedType = "ticketing";
    } else if (explicitType === "hybrid" || (hasTickets && hasCategories)) {
      resolvedType = "hybrid";
    } else if (hasTickets && !hasCategories) {
      resolvedType = "ticketing";
    } else {
      resolvedType = "voting";
    }

    const imagePath = meta?.image_path ?? (event as any).image_path;
    const imageUrl = imagePath ? imageUrlMap.get(imagePath) ?? null : null;

    return {
      ...event,
      event_type: resolvedType,
      venue_name: meta?.venue_name ?? (event as any).venue_name,
      doors_open_time: meta?.doors_open_time ?? (event as any).doors_open_time,
      imageUrl,
      ...states.get(event.id),
    };
  }) as EventItem[];
  // eslint-disable-next-line react-hooks/purity -- Evaluate voting windows once in this async Server Component.
  const requestTime = Date.now();

  return (
    <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900 dark:bg-black dark:text-stone-100 transition-colors">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors dark:text-stone-400 dark:hover:text-stone-200"
          >
            <Icon name="arrowLeft" size={14} />
            <span>All Organizations</span>
          </Link>
        </div>

        {/* Workspace Header Strip */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-stone-200 pb-6 dark:border-[#1c2721]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">ORGANIZATION WORKSPACE</p>
              <span className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-600 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300">
                {membership?.role ?? "member"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
              {organization?.name ?? "Your organization"}
            </h1>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Manage awards, nominees, categories, publication, and live voter traffic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/organizer/${organizationId}/analytics`}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs transition-all hover:border-emerald-600/30 hover:bg-emerald-50/30 hover:text-emerald-900 active:scale-95 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:bg-[#141d18] dark:hover:text-emerald-400"
            >
              <Icon name="sparkle" size={14} className="text-emerald-700 dark:text-emerald-400" />
              <span>Analytics</span>
            </Link>

            <Link
              href={`/organizer/${organizationId}/payments`}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs transition-all hover:border-amber-500/30 hover:bg-amber-50/30 hover:text-amber-900 active:scale-95 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:bg-[#141d18] dark:hover:text-amber-400"
            >
              <Icon name="coin" size={14} className="text-amber-600 dark:text-amber-400" />
              <span>Payouts & Bank</span>
            </Link>

            {isManager && (
              <Link
                href={`/organizer/${organizationId}/team`}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs transition-all hover:bg-stone-50 hover:text-stone-900 active:scale-95 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:bg-[#141d18] dark:hover:text-white"
              >
                <Icon name="users" size={14} className="text-stone-500 dark:text-stone-400" />
                <span>Team</span>
              </Link>
            )}

            {canCreateEvent && (
              <CreateEventModal organizationId={organizationId} />
            )}
          </div>
        </div>

        {/* Error State */}
        {membershipError || eventsError || orgError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center shadow-xs dark:border-red-900/60 dark:bg-red-950/40">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">
              <Icon name="alert" size={20} />
            </div>
            <h2 className="text-base font-bold text-stone-900 dark:text-white">We could not load this workspace</h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
              An error occurred while fetching the events. Refresh the page or try again shortly.
            </p>
            <Link
              href={`/organizer/${organizationId}/events`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Try again ↻
            </Link>
          </div>
        ) : (
          <>
            {/* Interactive Events Section */}
            <OrganizationEventsList events={eventRows} organizationId={organizationId} now={requestTime} />

            {/* SMS Credit Banner */}
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/40 p-5 shadow-xs sm:p-6 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-[#0c120e] dark:to-emerald-950/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50">
                    <Icon name="sparkle" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white">SMS credits for free voter verification</h3>
                    <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-300">
                      Prepay Ghana OTP verification messages, monitor real-time balance, and protect ballot integrity.
                    </p>
                  </div>
                </div>

                <Link
                  href={`/organizer/${organizationId}/credits`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition-all self-start sm:self-auto dark:border-emerald-800/60 dark:bg-[#0c120e] dark:text-emerald-300 dark:hover:bg-[#141d18]"
                >
                  <span>Manage SMS Credits</span>
                  <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            </div>

            {/* Organization Settings / Closure for Admins */}
            {isManager && (
              <div className="border-t border-stone-200 pt-6 dark:border-[#1c2721]">
                <ClosureRequestForm organizationId={organizationId} />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
