import { PublicTicketWidget } from "@/components/tickets/public-ticket-widget";
import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UssdInstructions, loadUssdInstructions } from "@/components/events/ussd-instructions";
import { WhatsAppInstructions } from "@/components/events/whatsapp-instructions";
import { PublicBallot } from "@/components/events/public-ballot";
import { SiteHeader } from "@/components/site-header";
import { FreeVoteForm } from "@/components/voting/free-vote-form";
import { EventVoterVerification } from "@/components/voting/event-voter-verification";
import { PaidVoteForm } from "@/components/voting/paid-vote-form";
import { createClient } from "@/lib/supabase/server";
import { votingRuleSummary, type VotingRule } from "@/lib/voting-rules";
import { EventNotices } from "@/components/events/event-notices";
import { VotingNotice } from "@/components/events/voting-notice";
import { eventPresentation } from "@/lib/events/presentation";
import { ShareButton } from "@/components/sharing/share-buttons";
import { EventViewTracker } from "@/components/analytics/event-view-tracker";
import { Icon } from "@/components/icon";
import { loadPublicSearchMetadata } from "@/lib/seo/public-data";
import { publicMetadata, PRIVATE_ROBOTS, breadcrumbs } from "@/lib/seo/metadata";
import { StructuredData } from "@/components/seo/structured-data";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ nominee?: string; category?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await loadPublicSearchMetadata(slug);
    if (!data) return { title: "Event unavailable", robots: PRIVATE_ROBOTS };
    return publicMetadata(data.name, data.description || `Explore ${data.name} on VotecastHub GH. Meet nominees and read the voting rules and schedule.`, data.path, `/api/og?event=${encodeURIComponent(slug)}`);
  } catch {
    return { title: "Event temporarily unavailable", robots: PRIVATE_ROBOTS };
  }
}

function ghDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export default async function PublicEventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const focusedNomineeId = typeof query?.nominee === "string" ? query.nominee : undefined;
  let event: {
    id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    unit_price_minor: number;
    starts_at: string;
    ends_at: string;
    status: string;
    voting_mode: "free" | "paid";
    voting_rule: VotingRule;
    voting_rules: string | null;
    voter_help_email?: string | null;
    free_vote_limit_per_phone: number | null;
    verification_method?: "phone" | "email" | "invite_code" | "voter_list";
    results_visibility: string;
    results_released: boolean;
    event_type?: "voting" | "ticketing" | "hybrid";
    venue_name?: string | null;
    venue_address?: string | null;
    doors_open_time?: string | null;
  } | null = null;

  let ticketTiers: Array<{
    id: string;
    event_id: string;
    name: string;
    price_minor: number;
    capacity: number;
    sold_count: number;
    description?: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }> = [];

  let categories: Array<{ id: string; name: string; description: string | null }> = [];
  let nominees: Array<{
    id: string;
    category_id: string;
    name: string;
    public_code: string | null;
    biography: string | null;
    image_path: string | null;
  }> = [];

  let imageUrlByPath = new Map<string, string>();
  let eventImageUrl: string | null = null;
  let publicResults: Array<{ nominee_id: string; vote_count: number }> = [];
  let unavailable = false;
  let voterInputTypes: ("email" | "phone" | "identifier" | "invite_code")[] = [];
  let phoneVerified = false;
  let emailVerified = false;
  let voterVerified = false;
  let rosterRemaining: number | null = null;
  let voterAuthStatus = {
    isAuthenticated: false,
    isVerified: false,
    hasAccessCode: false,
    hasVoterList: false,
  };
  let voterUserId: string | null = null;
  let voterUsage: Array<{ category_id: string; nominee_id: string; quantity: number }> = [];
  let votingOpen = false;

  try {
    const supabase = await createClient();
    try {
      const { data: userData } = await supabase.auth.getUser();
      voterUserId = userData.user?.id ?? null;
      voterAuthStatus.isAuthenticated = Boolean(voterUserId);
      phoneVerified = Boolean(userData.user?.phone && userData.user.phone_confirmed_at);
      emailVerified = Boolean(userData.user?.email && userData.user.email_confirmed_at);
    } catch {
      voterUserId = null;
      phoneVerified = false;
      emailVerified = false;
    }

    const eventResult = await supabase
      .from("events")
      .select(
        "id, name, description, image_path, unit_price_minor, starts_at, ends_at, status, voting_mode, voting_rule, voting_rules, voter_help_email, free_vote_limit_per_phone, verification_method, results_visibility, results_released, event_type, venue_name, venue_address, doors_open_time"
      )
      .eq("slug", slug)
      .in("status", ["published", "paused", "closed"])
      .maybeSingle();

    if (eventResult.error) {
      unavailable = true;
    } else if (eventResult.data) {
      event = eventResult.data;
      if (event.image_path) {
        const signedEventImage = await supabase.storage.from("nominee-images").createSignedUrl(event.image_path, 3600);
        eventImageUrl = signedEventImage.data?.signedUrl ?? null;
      }

      // Fetch active ticket tiers for this event
      const { data: tiersData } = await supabase
        .from("event_ticket_tiers")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      ticketTiers = (tiersData as any) ?? [];
      if (event.voting_mode === "free") {
        const openResult = await supabase.rpc("is_free_voting_open", { p_event_id: event.id });
        votingOpen = openResult.data === true;

        // Multi-method eligibility evaluation
        const method = event.verification_method ?? "phone";
        if (method === "voter_list") {
          const { data: types } = await supabase.rpc("get_event_voter_input_types", { p_event_id: event.id });
          if (Array.isArray(types)) voterInputTypes = types.filter((type): type is "phone" | "email" | "identifier" => type === "phone" || type === "email" || type === "identifier");
        }
        if (voterUserId) {
          if (method === "phone") {
            voterVerified = phoneVerified;
          } else if (method === "email") {
            voterVerified = emailVerified;
          } else {
            // For invite_code or voter_list, verify via RPC
            const { data: eligibility } = await supabase.rpc("check_voter_event_eligibility", { p_event_id: event.id });
            const el = eligibility as { is_verified?: boolean; has_access_code?: boolean; has_voter_list?: boolean; voter_list_max?: number; voter_list_used?: number } | null;
            if (el) {
              voterVerified = Boolean(el.is_verified);
              if (method === "voter_list" && el.has_voter_list) rosterRemaining = Math.max(0, (el.voter_list_max ?? 0) - (el.voter_list_used ?? 0));
              voterAuthStatus = {
                isAuthenticated: true,
                isVerified: voterVerified,
                hasAccessCode: Boolean(el.has_access_code),
                hasVoterList: Boolean(el.has_voter_list),
              };
            }
          }
        }

        if (votingOpen && voterVerified && voterUserId) {
          const usageResult = await supabase
            .from("vote_batches")
            .select("category_id, nominee_id, quantity")
            .eq("event_id", event.id)
            .eq("voter_user_id", voterUserId)
            .is("payment_attempt_id", null);
          if (!usageResult.error) voterUsage = usageResult.data ?? [];
        }
      }
      if (event.results_visibility === "live" || event.results_visibility === "after_close") {
        const results = await supabase.rpc("get_public_event_results", { p_event_id: event.id });
        if (!results.error) publicResults = results.data ?? [];
      }
      const categoryResult = await supabase
        .from("categories")
        .select("id, name, description")
        .eq("event_id", event.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (categoryResult.error) {
        unavailable = true;
      } else {
        categories = categoryResult.data ?? [];
        const ids = categories.map((category) => category.id);
        if (ids.length) {
          const nomineeResult = await supabase
            .from("nominees")
            .select("id, category_id, name, public_code, biography, image_path")
            .in("category_id", ids)
            .eq("is_active", true)
            .order("display_order", { ascending: true });

          if (nomineeResult.error) {
            unavailable = true;
          } else {
            nominees = nomineeResult.data ?? [];
            const paths = nominees
              .map((nominee) => nominee.image_path)
              .filter((path): path is string => Boolean(path));
            if (paths.length) {
              const { data: signedImages } = await supabase.storage
                .from("nominee-images")
                .createSignedUrls(paths, 3600);
              imageUrlByPath = new Map(
                (signedImages ?? []).flatMap((image) =>
                  image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []
                )
              );
            }
          }
        }
      }
    }
  } catch {
    unavailable = true;
  }

  if (!event && !unavailable) notFound();

  if (unavailable || !event) {
    return (
      <main className="min-h-screen bg-stone-50/70 pb-16">
        <SiteHeader />
        <div className="mx-auto max-w-xl px-4 pt-16 text-center">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xs">
            <span className="text-3xl text-emerald-800">↻</span>
            <h1 className="mt-3 text-lg font-serif font-bold text-stone-900">
              Event details are temporarily unavailable.
            </h1>
            <p className="mt-1 text-xs text-stone-500">Please refresh or try again in a little while.</p>
            <Link
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:bg-stone-100 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              href="/events"
            >
              ← Back to all events
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const nomineesByCategory = new Map<string, typeof nominees>();
  for (const nominee of nominees) {
    nomineesByCategory.set(nominee.category_id, [...(nomineesByCategory.get(nominee.category_id) ?? []), nominee]);
  }

  const ussdInfo = await loadUssdInstructions(event.id);
  const presentation = eventPresentation(event);
  const status = presentation.label;
  const resultsByNominee = new Map(publicResults.map((result) => [result.nominee_id, Number(result.vote_count)]));
  const resultsByNomineeRecord: Record<string, number> = Object.fromEntries(resultsByNominee.entries());
  const imageUrlByPathRecord: Record<string, string> = Object.fromEntries(imageUrlByPath.entries());
  const usedByCategory = new Map<string, number>();
  const usedByNominee = new Map<string, number>();
  for (const batch of voterUsage) {
    usedByCategory.set(batch.category_id, (usedByCategory.get(batch.category_id) ?? 0) + batch.quantity);
    usedByNominee.set(batch.nominee_id, (usedByNominee.get(batch.nominee_id) ?? 0) + batch.quantity);
  }
  const voteCap = event.free_vote_limit_per_phone ?? 1;

  const isOpen = presentation.key === "open";
  const isTicketOnly = event.event_type === "ticketing" || (ticketTiers.length > 0 && categories.length === 0);

  const focusedNominee = focusedNomineeId ? nominees.find((n) => n.id === focusedNomineeId) : null;
  const focusedCategory = focusedNominee ? categories.find((c) => c.id === focusedNominee.category_id) : null;
  const focusedImageUrl = focusedNominee ? imageUrlByPath.get(focusedNominee.image_path ?? "") : null;
  const votePath = focusedNominee ? `/events/${slug}?nominee=${focusedNominee.id}` : `/events/${slug}`;
  const focusedUsed = focusedNominee
    ? event.voting_rule === "per_nominee_limit"
      ? usedByNominee.get(focusedNominee.id) ?? 0
      : usedByCategory.get(focusedNominee.category_id) ?? 0
    : 0;
  const focusedRemaining = Math.max(0, Math.min(voteCap - focusedUsed, rosterRemaining ?? voteCap));
  const siblingNominees = focusedNominee
    ? nominees.filter((n) => n.category_id === focusedNominee.category_id && n.id !== focusedNominee.id)
    : [];

  return (
    <main className="min-h-screen bg-stone-50/70 pb-28 text-stone-900 transition-colors dark:bg-[#080b09] dark:text-stone-100">
      <SiteHeader />
      <StructuredData data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }, { name: event.name, path: `/events/${slug}` }])} />
      <EventViewTracker eventId={event.id} />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 space-y-8">
        {/* ============================================================== */}
        {/* 1. DEDICATED MINIMAL VOTING TERMINAL (When Nominee Is Selected) */}
        {/* ============================================================== */}
        {focusedNominee && focusedCategory ? (
          <div className="mx-auto max-w-xl space-y-6 pt-2">
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between">
              <Link
                href={`/events/${slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
              >
                <span>← View all categories in {event.name}</span>
              </Link>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                Direct Ballot
              </span>
            </div>

            {/* Focused Nominee Spotlight Ballot Card */}
            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-sm dark:border-[#1c2721] dark:bg-[#0c120e]">
              <div className="flex flex-col items-center text-center">
                {/* Nominee Photo */}
                <div className="relative h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-2xl border-2 border-emerald-500 shadow-md">
                  {focusedImageUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${focusedImageUrl}")` }}
                      role="img"
                      aria-label={`${focusedNominee.name} photo`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-emerald-950 font-serif text-3xl font-bold text-emerald-300">
                      {focusedNominee.name.trim().slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold shadow">
                    ✓
                  </span>
                </div>

                {/* Category & Title */}
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">
                  {focusedCategory.name}
                </p>
                <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-white">
                  {focusedNominee.name}
                </h1>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  {focusedNominee.public_code && (
                    <span className="rounded-md border border-stone-200 bg-stone-100 px-2.5 py-0.5 font-mono text-xs font-bold text-stone-800 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200">
                      Code: {focusedNominee.public_code}
                    </span>
                  )}
                  <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                    {event.voting_mode === "free" ? "Free Public Voting" : `GH₵ ${(event.unit_price_minor / 100).toFixed(2)} / vote`}
                  </span>
                </div>

                {focusedNominee.biography && (
                  <p className="mt-3 max-w-md text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                    {focusedNominee.biography}
                  </p>
                )}
              </div>

              {/* Direct Voting Terminal */}
              <div className="mt-6 border-t border-stone-100 pt-6 dark:border-[#1c2721]">
                {event.voting_mode === "paid" && status === "Voting open" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-emerald-50/70 p-3 text-xs text-emerald-900 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-200">
                      ⚡ <strong>Instant Checkout:</strong> Select your vote quantity and complete payment securely via Mobile Money (MTN, Telecel, AT) or Card.
                    </div>
                    <PaidVoteForm
                      eventId={event.id}
                      categoryId={focusedCategory.id}
                      nomineeId={focusedNominee.id}
                      nomineeName={focusedNominee.name}
                      unitPriceMinor={event.unit_price_minor}
                    />
                  </div>
                ) : event.voting_mode === "free" && votingOpen ? (
                  voterVerified ? (
                    focusedRemaining > 0 ? (
                      <div className="space-y-4">
                        <div className="rounded-xl bg-emerald-50/70 p-3 text-xs text-emerald-900 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-200">
                          ✓ <strong>You are verified:</strong> You have {focusedRemaining} free votes remaining for this nominee.
                        </div>
                        <FreeVoteForm
                          eventId={event.id}
                          categoryId={focusedCategory.id}
                          nomineeId={focusedNominee.id}
                          nomineeName={focusedNominee.name}
                          nextPath={votePath}
                          maxQuantity={focusedRemaining}
                          requestKey={randomUUID()}
                          phoneVerified={true}
                          verificationMethod={event.verification_method ?? "phone"}
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl bg-amber-50 p-4 text-center text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
                        You have reached your vote limit {event.voting_rule === "per_nominee_limit" ? "for this nominee" : "in this category"}.
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-emerald-50/80 p-3.5 text-xs text-emerald-950 border border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-200">
                        <strong>1-Step Voter Verification:</strong> Verify your details once below to cast your free ballot for <strong>{focusedNominee.name}</strong>.
                      </div>
                      <EventVoterVerification
                        eventId={event.id}
                        method={event.verification_method ?? "phone"}
                        isVerified={voterVerified}
                        hasRedeemed={voterAuthStatus.hasVoterList}
                        available={votingOpen}
                        inputTypes={voterInputTypes}
                      />
                    </div>
                  )
                ) : (
                  <p className="rounded-xl bg-stone-100 p-4 text-center text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-300">
                    Voting is currently closed or paused for this event.
                  </p>
                )}
              </div>

              {/* WhatsApp voting option */}
              {focusedNominee.public_code && (
                <div className="mt-5 border-t border-stone-100 pt-4 text-center dark:border-[#1c2721]">
                  <a
                    href={`https://wa.me/233592992566?text=${encodeURIComponent(`VOTE ${ussdInfo?.event_code ?? slug} ${focusedNominee.public_code}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:underline dark:text-emerald-400"
                  >
                    <span>💬 Prefer WhatsApp? Vote for {focusedNominee.name} on WhatsApp bot →</span>
                  </a>
                </div>
              )}
            </div>

            {/* Sibling Contenders in Same Category (Horizontal Rail) */}
            {siblingNominees.length > 0 && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Other Contenders in {focusedCategory.name}:
                </p>
                <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
                  {siblingNominees.map((sib) => {
                    const sibImage = imageUrlByPath.get(sib.image_path ?? "");
                    return (
                      <Link
                        key={sib.id}
                        href={`/events/${slug}?nominee=${sib.id}`}
                        className="group flex shrink-0 items-center gap-2 rounded-xl border border-stone-200/80 bg-stone-50/60 p-2 text-left transition hover:border-emerald-500 hover:bg-white dark:border-[#1c2721] dark:bg-[#121914] dark:hover:border-emerald-600"
                      >
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-[#1a251f]">
                          {sibImage ? (
                            <div
                              className="h-full w-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${sibImage}")` }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-serif text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              {sib.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 pr-1">
                          <p className="truncate text-xs font-bold text-stone-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400 max-w-[120px]">
                            {sib.name}
                          </p>
                          <p className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                            {sib.public_code || "Contender"}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Link to view full event announcements */}
            <div className="text-center pt-2">
              <Link
                href={`/events/${slug}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300"
              >
                View Full Event Announcements &amp; Other Categories
              </Link>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* 2. FULL GENERAL EVENT OVERVIEW (When No Specific Nominee Is Focused) */
          /* ============================================================== */
          <>
            {/* Navigation & Share Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/events"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-[#141b16]"
              >
                <Icon name="arrowLeft" size={13} />
                <span>All events</span>
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                {(event.results_visibility === "live" ||
                  (event.results_visibility === "after_close" &&
                    (status === "Voting ended" || event.results_released))) && (
                  <Link
                    href={`/results/${slug}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-500/20 transition-all dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                  >
                    <span>🏆 View Standings &amp; Results</span>
                  </Link>
                )}

                <ShareButton
                  title={event.name}
                  text={isTicketOnly ? `Get tickets for ${event.name}` : `${presentation.cta} — ${event.name}`}
                  url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${slug}`}
                  flyer={isTicketOnly ? undefined : {
                    ussd: ussdInfo ?? undefined,
                    eventName: event.name,
                    imageUrl: eventImageUrl,
                    startsAt: event.starts_at,
                    endsAt: event.ends_at,
                    status: event.status,
                    votingMode: event.voting_mode,
                    unitPriceMinor: event.unit_price_minor,
                    eventCode: ussdInfo?.event_code ? String(ussdInfo.event_code) : slug,
                  }}
                />
              </div>
            </div>

            {/* Hero Section */}
            <section className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              {eventImageUrl ? (
                <div
                  className="relative h-56 sm:h-80 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${eventImageUrl}")` }}
                  role="img"
                  aria-label={`${event.name} cover image`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                </div>
              ) : (
                <div className="h-28 sm:h-36 bg-gradient-to-r from-emerald-950 via-emerald-900 to-stone-900" />
              )}

              <div className="p-6 sm:p-8 space-y-5">
                {/* Status Pill & Header */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${isOpen
                        ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800"
                        : "bg-stone-100 text-stone-600 border border-stone-200 dark:border-[#1c2721] dark:bg-[#141b16] dark:text-stone-300"
                      }`}
                  >
                    {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                    <span>{status}</span>
                  </span>
                  <span className="text-xs text-stone-400 font-medium dark:text-stone-400">
                    · {isTicketOnly ? "Official Event Tickets" : "Official Voting Ballot"}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-serif font-bold text-stone-900 tracking-tight leading-tight dark:text-white">
                  {event.name}
                </h1>

                <p className="text-sm sm:text-base text-stone-600 max-w-3xl leading-relaxed dark:text-stone-300">
                  {event.description || (isTicketOnly ? "Get your official entry tickets below." : "Cast your vote for the nominees below.")}
                </p>

                {/* Venue & Date Details for Ticketed Events */}
                {event.venue_name && (
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-stone-700 bg-stone-50 p-3 rounded-2xl border border-stone-200/80 dark:border-[#1c2721] dark:bg-[#080b09] dark:text-stone-300">
                    <span>📍 <strong>Venue:</strong> {event.venue_name} {event.venue_address ? `(${event.venue_address})` : ""}</span>
                    {event.doors_open_time && <span>⏰ <strong>Doors open:</strong> {event.doors_open_time}</span>}
                  </div>
                )}

                {/* Voting Schedule & Mode Info Cards (Only if voting event) */}
                {!isTicketOnly && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-stone-100 dark:border-[#1c2721]">
                    <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3.5 dark:border-[#1c2721] dark:bg-[#080b09]">
                      <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Voting Opens</span>
                      <p className="mt-0.5 text-xs font-semibold text-stone-900 font-mono dark:text-stone-100">{ghDate(event.starts_at)}</p>
                    </div>

                    <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3.5 dark:border-[#1c2721] dark:bg-[#080b09]">
                      <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Voting Closes</span>
                      <p className="mt-0.5 text-xs font-semibold text-stone-900 font-mono dark:text-stone-100">{ghDate(event.ends_at)}</p>
                    </div>

                    <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3.5 dark:border-[#1c2721] dark:bg-[#080b09]">
                      <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Ballot Type</span>
                      <p className="mt-0.5 text-xs font-semibold text-stone-900 dark:text-stone-100">
                        {event.voting_mode === "free"
                          ? "Free voting"
                          : `GH₵ ${(event.unit_price_minor / 100).toFixed(2)} per vote`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Rules and Disclaimers */}
                {event.voting_mode === "free" && !isTicketOnly && (
                  <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50/30 p-4 text-xs space-y-1 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <p className="font-semibold text-emerald-950 dark:text-emerald-300">
                      Your voting limit: {votingRuleSummary(event.voting_rule, event.free_vote_limit_per_phone)}
                    </p>
                    {event.voting_rules && (
                      <p className="text-stone-600 leading-relaxed dark:text-stone-300">
                        <strong>Organizer Instructions:</strong> {event.voting_rules}
                      </p>
                    )}
                  </div>
                )}

                {event.voting_mode === "paid" && event.voting_rules && !isTicketOnly && (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 text-xs text-stone-700 dark:border-[#1c2721] dark:bg-[#080b09] dark:text-stone-300">
                    <p className="font-semibold text-stone-900 dark:text-stone-100">Event Notice</p>
                    <p className="mt-1 text-stone-600 leading-relaxed dark:text-stone-300">{event.voting_rules}</p>
                  </div>
                )}

                {/* Tickets Widget (Rendered if event has ticketing or tiers) */}
                {(isTicketOnly || ticketTiers.length > 0) && (
                  <div className="pt-2">
                    <PublicTicketWidget
                      eventId={event.id}
                      eventName={event.name}
                      eventImageUrl={eventImageUrl}
                      venueName={event.venue_name}
                      venueAddress={event.venue_address}
                      doorsOpenTime={event.doors_open_time}
                      tiers={ticketTiers}
                    />
                  </div>
                )}

                {/* Optional Organizer Updates & Alternative Chat Bot Voting (WhatsApp, Telegram & USSD) */}
                {!isTicketOnly && (
                  <details className="group my-3 overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-50/70 transition-all hover:border-emerald-300 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80">
                    <summary className="flex cursor-pointer select-none list-none items-center justify-between p-3.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100/70 dark:text-stone-300 dark:hover:bg-[#121a14]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          📢
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate font-semibold text-stone-900 dark:text-white">
                            Organizer Updates &amp; Chat Bot Voting (WhatsApp, Telegram &amp; USSD)
                          </span>
                          <span className="block truncate text-[10px] text-stone-500 dark:text-stone-400">
                            Optional · Tap to view dial codes, chat links, and announcements
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-400 ml-2">
                        <span className="group-open:hidden">View options ↓</span>
                        <span className="hidden group-open:inline">Hide options ↑</span>
                      </span>
                    </summary>

                    <div className="space-y-4 border-t border-stone-200/80 p-4 pt-3 dark:border-[#1c2721]">
                      <EventNotices eventId={event.id} />
                      <WhatsAppInstructions eventId={event.id} eventSlug={slug} votingMode={event.voting_mode} />
                      <UssdInstructions eventId={event.id} />
                    </div>
                  </details>
                )}

                {/* Free Voting Verification (Only shown when voting mode is free) */}
                {!isTicketOnly && event.voting_mode === "free" && (
                  <div id="voter-verification" className="space-y-3 pt-2">
                    {event.verification_method === "voter_list" && (
                      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
                        {rosterRemaining === null
                          ? "Your approved voter list also sets a total allowance across the whole event. Your remaining total will appear after verification."
                          : `You have ${rosterRemaining} total votes remaining across the whole event. The per-category or per-nominee limit above also applies.`}
                      </p>
                    )}
                    <EventVoterVerification
                      eventId={event.id}
                      method={event.verification_method ?? "phone"}
                      isVerified={voterVerified}
                      hasRedeemed={voterAuthStatus.hasVoterList}
                      available={votingOpen}
                      inputTypes={voterInputTypes}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* The Official Ballot: Categories & Nominees */}
            {!isTicketOnly && (
              categories.length ? (
                <PublicBallot
                  eventId={event.id}
                  eventName={event.name}
                  eventSlug={slug}
                  votingMode={event.voting_mode as "paid" | "free"}
                  unitPriceMinor={event.unit_price_minor}
                  isOpen={isOpen}
                  status={status}
                  categories={categories}
                  nominees={nominees}
                  imageUrlByPath={imageUrlByPathRecord}
                  resultsByNominee={resultsByNomineeRecord}
                  ussdInfo={ussdInfo}
                  eventStartsAt={event.starts_at}
                  eventEndsAt={event.ends_at}
                  eventStatus={event.status}
                  isFreeVerified={voterVerified}
                  freeRemaining={voteCap}
                  freeVerificationMethod={event.verification_method ?? "phone"}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-300 p-12 text-center text-stone-500 dark:border-[#223028]">
                  <h3 className="font-serif font-semibold text-stone-900 text-base dark:text-stone-100">
                    Nominees are being prepared.
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">Check back closer to the scheduled opening time.</p>
                </div>
              )
            )}

            {/* Voter Assistance Card */}
            {!isTicketOnly && (
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
                <div>
                  <strong className="block text-stone-900 font-semibold dark:text-stone-100">
                    Need help with your ballot or private access code?
                  </strong>
                  <span className="text-stone-500 text-[11px] dark:text-stone-400">
                    Reach out to our platform support team or contact the event organizer directly.
                  </span>
                </div>
                <a
                  href={`mailto:${event.voter_help_email || "support@votecasthub.com"}?subject=${encodeURIComponent(`Voting help: ${event.name}`)}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 dark:border-[#223028] dark:bg-[#121914] dark:text-stone-200"
                >
                  {event.voter_help_email ? "Contact Organizer" : "Platform Support"}
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-stone-200 bg-white py-10 dark:border-[#1c2721] dark:bg-[#0c120e]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-serif font-bold text-stone-900 text-sm dark:text-white">
              VotecastHub <span className="text-emerald-800 dark:text-emerald-400">GH</span>
            </Link>
            <span>· Trusted ballot verification for Ghana</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>© {new Date().getFullYear()} VotecastHub GH</span>
            <Link href="/about" className="hover:text-stone-900 dark:hover:text-stone-200">
              About
            </Link>
            <Link href="/privacy" className="hover:text-stone-900 dark:hover:text-stone-200">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-stone-900 dark:hover:text-stone-200">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
