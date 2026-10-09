import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
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

type Props = { params: Promise<{ slug: string }> };

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

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;
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
    free_vote_limit_per_phone: number | null;
    verification_method?: "phone" | "email" | "invite_code" | "voter_list";
    results_visibility: string;
    results_released: boolean;
  } | null = null;

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
        "id, name, description, image_path, unit_price_minor, starts_at, ends_at, status, voting_mode, voting_rule, voting_rules, free_vote_limit_per_phone, verification_method, results_visibility, results_released"
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
              if (method === "voter_list") rosterRemaining = Math.max(0, (el.voter_list_max ?? 0) - (el.voter_list_used ?? 0));
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
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline"
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

  const presentation = eventPresentation(event);
  const status = presentation.label;
  const votePath = `/events/${slug}`;
  const resultsByNominee = new Map(publicResults.map((result) => [result.nominee_id, Number(result.vote_count)]));
  const usedByCategory = new Map<string, number>();
  const usedByNominee = new Map<string, number>();
  for (const batch of voterUsage) {
    usedByCategory.set(batch.category_id, (usedByCategory.get(batch.category_id) ?? 0) + batch.quantity);
    usedByNominee.set(batch.nominee_id, (usedByNominee.get(batch.nominee_id) ?? 0) + batch.quantity);
  }
  const voteCap = event.free_vote_limit_per_phone ?? 1;

  const isOpen = presentation.key === "open";

  return (
    <main className="min-h-screen bg-stone-50/70 pb-28 text-stone-900">
      <SiteHeader />
      <StructuredData data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }, { name: event.name, path: `/events/${slug}` }])} />
      <EventViewTracker eventId={event.id} />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 space-y-8">
        {/* Navigation & Share Row */}
        <div className="flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-emerald-900 transition-colors"
          >
            <Icon name="arrowLeft" size={13} />
            <span>All events</span>
          </Link>

          <ShareButton
            title={event.name}
            text={`${presentation.cta} — ${event.name}`}
            url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${slug}`}
            flyer={{
              eventName: event.name,
              imageUrl: eventImageUrl,
              startsAt: event.starts_at,
              endsAt: event.ends_at,
              status: event.status,
              votingMode: event.voting_mode,
              unitPriceMinor: event.unit_price_minor,
            }}
          />
        </div>

        {/* Hero Section */}
        <section className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs">
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
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  isOpen
                    ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600/20"
                    : "bg-stone-100 text-stone-600 border border-stone-200"
                }`}
              >
                {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                <span>{status}</span>
              </span>
              <span className="text-xs text-stone-400 font-medium">· Official Voting Ballot</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-serif font-bold text-stone-900 tracking-tight leading-tight">
              {event.name}
            </h1>

            <p className="text-sm sm:text-base text-stone-600 max-w-3xl leading-relaxed">
              {event.description || "Cast your vote for the nominees below."}
            </p>

            {/* Voting Schedule & Mode Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-stone-100">
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3.5">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Voting Opens</span>
                <p className="mt-0.5 text-xs font-semibold text-stone-900 font-mono">{ghDate(event.starts_at)}</p>
              </div>

              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3.5">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Voting Closes</span>
                <p className="mt-0.5 text-xs font-semibold text-stone-900 font-mono">{ghDate(event.ends_at)}</p>
              </div>

              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3.5">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Ballot Type</span>
                <p className="mt-0.5 text-xs font-semibold text-stone-900">
                  {event.voting_mode === "free"
                    ? "Free voting"
                    : `GH₵ ${(event.unit_price_minor / 100).toFixed(2)} per vote`}
                </p>
              </div>
            </div>

            {/* Rules and Disclaimers */}
            {event.voting_mode === "free" && (
              <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50/30 p-4 text-xs space-y-1">
                <p className="font-semibold text-emerald-950">
                  Fairness Rule: {votingRuleSummary(event.voting_rule, event.free_vote_limit_per_phone)}
                </p>
                {event.voting_rules && (
                  <p className="text-stone-600 leading-relaxed">
                    <strong>Organizer Instructions:</strong> {event.voting_rules}
                  </p>
                )}
              </div>
            )}

            {event.voting_mode === "paid" && event.voting_rules && (
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 text-xs text-stone-700">
                <p className="font-semibold text-stone-900">Event Notice</p>
                <p className="mt-1 text-stone-600 leading-relaxed">{event.voting_rules}</p>
              </div>
            )}

            {/* Notices and Results Banners */}
            <EventNotices eventId={event.id} />
            <VotingNotice
              event={event}
              resultsVisibility={event.results_visibility}
              resultsReleased={event.results_released}
            />

            {/* Voter Verification Section */}
            <div id="voter-verification" className="space-y-3">
              <div className="rounded-2xl border border-stone-200 bg-gradient-to-r from-stone-50 to-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 font-bold">
                    <Icon name="shield" size={15} />
                  </div>
                  <div>
                    <strong className="text-stone-900 font-semibold block">
                      {event.voting_mode === "free" ? "Voter Verification" : "Secure Payment Gateway"}
                    </strong>
                    <span className="text-stone-500 text-[11px]">
                      {event.voting_mode === "free"
                        ? event.verification_method === "email"
                          ? "Verify your email once, then cast your votes."
                          : event.verification_method === "invite_code"
                          ? "Enter your event access code once, then vote."
                          : event.verification_method === "voter_list"
                          ? "Confirm your approved voter credentials once, then vote."
                          : "Verify your Ghana phone number once with SMS, then vote."
                        : "Payments processed securely via Mobile Money & Cards with Paystack."}
                    </span>
                  </div>
                </div>

                {voterVerified && event.voting_mode === "free" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
                    <Icon name="check" size={12} />
                    <span>Verified</span>
                  </span>
                )}
              </div>

              {event.voting_mode === "free" && (
                <EventVoterVerification eventId={event.id} method={event.verification_method ?? "phone"} isVerified={voterVerified} hasRedeemed={voterAuthStatus.hasVoterList} available={votingOpen} inputTypes={voterInputTypes} />
              )}

              {/* Open instructions note */}
              {isOpen && (
                <div className="rounded-xl bg-stone-100/70 p-3 text-xs text-stone-600">
                  {event.voting_mode === "free"
                    ? voterVerified
                      ? "Select a nominee below. Your remaining votes are shown on each candidate card."
                      : "Voting is free. Complete verification above, then select your nominees below."
                    : "Select your nominee and vote quantity below. Votes are recorded instantly after secure Mobile Money or Card payment."}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Categories & Nominees Section */}
        <section className="space-y-8">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">The Ballot</span>
              <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Categories & Nominees</h2>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
              {categories.length} {categories.length === 1 ? "Category" : "Categories"}
            </span>
          </div>

          {categories.length ? (
            categories.map((category) => {
              const categoryNominees = nomineesByCategory.get(category.id) ?? [];
              return (
                <section
                  key={category.id}
                  className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
                    <div>
                      <h3 className="text-xl font-serif font-bold text-stone-900">{category.name}</h3>
                      {category.description && (
                        <p className="mt-1 text-xs text-stone-500 leading-relaxed max-w-2xl">
                          {category.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-stone-400">
                      {categoryNominees.length} {categoryNominees.length === 1 ? "Nominee" : "Nominees"}
                    </span>
                  </div>

                  {/* Nominees Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryNominees.map((nominee) => {
                      const used =
                        event.voting_rule === "per_nominee_limit"
                          ? usedByNominee.get(nominee.id) ?? 0
                          : usedByCategory.get(category.id) ?? 0;
                      const remaining = Math.max(0, Math.min(voteCap - used, rosterRemaining ?? voteCap));
                      const imageUrl = imageUrlByPath.get(nominee.image_path ?? "");

                      return (
                        <article
                          key={nominee.id}
                          className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-4 shadow-2xs hover:shadow-xs transition-all"
                        >
                          <div className="space-y-3">
                            <Link
                              href={`/events/${slug}/nominees/${nominee.id}`}
                              className="group flex items-start gap-3.5"
                            >
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-2xs group-hover:scale-105 transition-transform">
                                {imageUrl ? (
                                  <div
                                    className="h-full w-full bg-cover bg-center"
                                    style={{ backgroundImage: `url("${imageUrl}")` }}
                                    role="img"
                                    aria-label={`${nominee.name} photo`}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center font-serif text-lg font-bold text-emerald-900 bg-emerald-50">
                                    {nominee.name.trim().slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <h4 className="font-semibold text-stone-900 text-sm leading-tight group-hover:text-emerald-900 transition-colors">
                                  {nominee.name}
                                </h4>
                                {nominee.public_code && (
                                  <span className="mt-1 inline-block rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-stone-700">
                                    {nominee.public_code}
                                  </span>
                                )}
                              </div>

                              <span className="text-stone-300 group-hover:text-stone-600 transition-colors text-xs">
                                ↗
                              </span>
                            </Link>

                            {/* Public Results (if released) */}
                            {resultsByNominee.has(nominee.id) && (
                              <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-1.5 text-xs">
                                <span className="text-stone-500 font-medium text-[11px]">Recorded Votes</span>
                                <strong className="font-mono text-stone-900 font-bold">
                                  {resultsByNominee.get(nominee.id)?.toLocaleString("en-GH")}
                                </strong>
                              </div>
                            )}
                          </div>

                          {/* Voting Action Section */}
                          <div className="mt-4 pt-3 border-t border-stone-100 space-y-3">
                            {event.voting_mode === "paid" && status === "Voting open" ? (
                              <PaidVoteForm
                                eventId={event.id}
                                categoryId={category.id}
                                nomineeId={nominee.id}
                                nomineeName={nominee.name}
                                unitPriceMinor={event.unit_price_minor}
                              />
                            ) : event.voting_mode === "free" && votingOpen ? (
                              voterVerified ? (
                                remaining > 0 ? (
                                  <FreeVoteForm
                                    eventId={event.id}
                                    categoryId={category.id}
                                    nomineeId={nominee.id}
                                    nomineeName={nominee.name}
                                    nextPath={votePath}
                                    maxQuantity={remaining}
                                    requestKey={randomUUID()}
                                    phoneVerified={true}
                                    verificationMethod={event.verification_method ?? "phone"}
                                  />
                                ) : (
                                  <p className="rounded-xl bg-stone-100 p-2 text-center text-[11px] font-medium text-stone-500">
                                    Limit reached {event.voting_rule === "per_nominee_limit" ? "for this nominee" : "in this category"}.
                                  </p>
                                )
                              ) : (
                                <FreeVoteForm
                                  eventId={event.id}
                                  categoryId={category.id}
                                  nomineeId={nominee.id}
                                  nomineeName={nominee.name}
                                  nextPath={votePath}
                                  maxQuantity={voterAuthStatus.hasVoterList && rosterRemaining === 0 ? 0 : voteCap}
                                  requestKey={randomUUID()}
                                  phoneVerified={false}
                                  verificationMethod={event.verification_method ?? "phone"}
                                />
                              )
                            ) : null}

                            {/* Candidate Flyer Share Button */}
                            <div className="flex justify-end pt-1">
                              <ShareButton
                                title={nominee.name}
                                text={`${nominee.name} — ${event.name}`}
                                url={`/events/${slug}/nominees/${nominee.id}`}
                                flyer={{
                                  nominee: nominee.name,
                                  eventName: event.name,
                                  category: category.name,
                                  code: nominee.public_code,
                                  imageUrl: imageUrlByPath.get(nominee.image_path ?? ""),
                                  startsAt: event.starts_at,
                                  endsAt: event.ends_at,
                                  status: event.status,
                                  votingMode: event.voting_mode,
                                  unitPriceMinor: event.unit_price_minor,
                                }}
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-300 p-12 text-center text-stone-500">
              <h3 className="font-serif font-semibold text-stone-900 text-base">Nominees are being prepared.</h3>
              <p className="text-xs text-stone-400 mt-1">Check back closer to the scheduled opening time.</p>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-stone-200 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-serif font-bold text-stone-900 text-sm">
              VotecastHub <span className="text-emerald-800">GH</span>
            </Link>
            <span>· Trusted ballot verification for Ghana</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>© {new Date().getFullYear()} VotecastHub GH</span>
            <Link href="/about" className="hover:text-stone-900">
              About
            </Link>
            <Link href="/privacy" className="hover:text-stone-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-stone-900">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
