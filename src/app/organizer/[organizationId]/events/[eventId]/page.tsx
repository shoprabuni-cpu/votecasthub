import { TicketTiersManager } from "@/components/tickets/ticket-tiers-manager";
import { UssdPaymentHistory } from "@/components/events/ussd-payment-history";
import { WhatsAppVotingInfo } from "@/components/events/whatsapp-voting-info";
import { TelegramVotingInfo } from "@/components/events/telegram-voting-info";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UssdRequest } from "@/components/events/ussd-request";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventImageForm } from "@/components/events/event-image-form";
import { EventStatusForm } from "@/components/events/event-status-form";
import { Icon } from "@/components/icon";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { ReopenEventForm } from "@/components/events/fairness-controls";
import { CorrectionRequestHistory } from "@/components/events/correction-history";
import { PublicEventEditor } from "@/components/events/public-event-editor";
import { DeleteEventForm } from "@/components/events/delete-event-form";
import { AccessCodeManager } from "@/components/events/access-code-manager";
import { isVotingRule } from "@/lib/voting-rules";
import { VoterHelpSettings } from "@/components/events/voter-help-settings";
import { VoterListManager } from "@/components/events/voter-list-manager";
import { CategoryNomineeStudio } from "@/components/events/category-nominee-studio";
import { EventReviewConversation } from "@/components/events/review-conversation";
import { organizerEventPresentation, type EventWorkspaceState } from "@/lib/events/organizer-presentation";
import { EventDetailsForm } from "@/components/events/event-details-form";
import { EventWorkspace } from "@/components/events/event-workspace";
import { eventEditPermissions } from "@/lib/events/edit-permissions";
import { eventNextStep } from "@/lib/events/next-step";
import { ghanaDate } from "@/lib/events/presentation";
import { EventPromotionTools } from "@/components/sharing/event-promotion-tools";
import { absoluteUrl } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Event setup" };
type Props = { params: Promise<{ organizationId: string; eventId: string }>; searchParams?: Promise<{ step?: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrganizationEvent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  unit_price_minor: number;
  starts_at: string;
  ends_at: string;
  status: string;
  results_visibility: string;
  voting_mode: "free" | "paid";
  free_vote_limit_per_phone: number | null;
  voting_rule: string;
  voting_rules: string | null;
  voter_help_email?: string | null;
  image_path: string | null;
  event_type?: string | null;
  venue_name?: string | null;
  doors_open_time?: string | null;
};

export default async function EventSetupPage({ params, searchParams }: Props) {
  const { organizationId, eventId } = await params;
  const requestedStep = (await searchParams)?.step;
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(eventId)) notFound();
  const { supabase, userId } = await requireVerifiedUser();

  const { data: ussdRequest, error: ussdError } = await supabase.from("event_ussd_requests").select("status,quote_id,amount_minor,terms,valid_until,access_paid,payment_status,enabled,event_code,dial_code,active_from,active_until").eq("event_id", eventId).maybeSingle();

  const [
    { data: eventRows, error: eventError },
    { data: membership, error: membershipError },
    { data: categories, error: categoriesError },
    { data: organization },
    { data: smsBalance },
    { data: eventMeta },
    { data: ticketTiers },
  ] = await Promise.all([
    supabase.rpc("get_organization_events", { p_organization_id: organizationId }),
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, description, display_order, is_active")
      .eq("event_id", eventId)
      .order("display_order", { ascending: true }),
    supabase.from("organizations").select("name, moderation_status, archived_at").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_sms_balance", { p_org: organizationId }),
    supabase.from("events").select("verification_method, voter_help_email, venue_name, venue_address, doors_open_time, event_type").eq("id", eventId).maybeSingle(),
    supabase.from("event_ticket_tiers").select("*").eq("event_id", eventId).order("sort_order", { ascending: true }),
  ]);

  const verificationMethod = (eventMeta?.verification_method ?? "phone") as "phone" | "email" | "invite_code" | "voter_list";

  const typedEventRows = (eventRows ?? []) as OrganizationEvent[];
  if (eventError || membershipError) {
    return (
      <main className="min-h-screen bg-stone-50/60 pb-16 dark:bg-black dark:text-stone-100 transition-colors">
        <DashboardHeader organizationId={organizationId} />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-10 text-center">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-xs dark:border-red-900/60 dark:bg-[#0c120e]">
            <h1 className="text-lg font-serif font-semibold text-stone-900 dark:text-white">We could not load this event.</h1>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Refresh the page or try again shortly.</p>
            <Link
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:bg-stone-100 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:text-emerald-400 dark:hover:bg-[#121914]"
              href={`/organizer/${organizationId}/events`}
            >
              ← Back to events
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const event = typedEventRows.find((item) => item.id === eventId);
  if (!event) notFound();

  const { data: paidCheckoutReady } =
    event.voting_mode === "paid"
      ? await supabase.rpc("can_publish_paid_event", { p_event_id: eventId })
      : { data: true };

  const canManage = organization?.moderation_status === "active" && !organization.archived_at && ["owner", "admin", "editor"].includes(membership?.role ?? "");
  const canRemove = canManage && ["owner", "admin"].includes(membership?.role ?? "");
  const activeCategories = (categories ?? []).filter((category) => category.is_active);
  const categoryIds = (categories ?? []).map((category) => category.id);

  const { data: nominees, error: nomineeError } = categoryIds.length
    ? await supabase
        .from("nominees")
        .select("id, category_id, name, public_code, biography, image_path, display_order, is_active")
        .in("category_id", categoryIds)
        .order("display_order", { ascending: true })
    : { data: [], error: null };

  const pagePath = `/organizer/${organizationId}/events/${eventId}`;
  const { data: workspaceStates } = await supabase.rpc("get_event_workspace_states", { p_organization_id: organizationId });
  const workspace = (workspaceStates as EventWorkspaceState[] | null)?.find(row => row.event_id === eventId);
  const activeNomineeCountByCategory = new Map<string, number>();
  for (const nominee of nominees ?? []) {
    if (nominee.is_active) {
      activeNomineeCountByCategory.set(
        nominee.category_id,
        (activeNomineeCountByCategory.get(nominee.category_id) ?? 0) + 1
      );
    }
  }

  const allCategoriesHaveNominees =
    activeCategories.length > 0 &&
    activeCategories.every((category) => (activeNomineeCountByCategory.get(category.id) ?? 0) > 0);

  // eslint-disable-next-line react-hooks/purity -- This async Server Component evaluates dates once per request.
  const requestTime = Date.now();
  const datesReady =
    new Date(event.starts_at) < new Date(event.ends_at) && new Date(event.ends_at).getTime() > requestTime;
  const presentation = organizerEventPresentation({ ...event, last_review_kind: workspace?.last_review_kind }, requestTime);
  const permissions = eventEditPermissions({ event, role: membership?.role ?? "", active: Boolean(canManage), hasActivity: workspace?.has_activity ?? null, now: requestTime });
  const votingRulesReady =
    event.voting_mode === "free" &&
    isVotingRule(event.voting_rule) &&
    (event.voting_rule !== "one_per_category" || event.free_vote_limit_per_phone === 1);
  const checkoutReady = event.voting_mode === "paid" ? paidCheckoutReady === true : votingRulesReady;
  const { data: verificationReadiness, error: verificationReadinessError } = await supabase.rpc("get_event_verification_readiness", { p_event_id: eventId });
  const verificationReady = !verificationReadinessError && verificationReadiness?.ready === true;
  const activeTiers = (ticketTiers ?? []).filter((tier: any) => tier.is_active);
  const tiersReady = activeTiers.length > 0;
  const hasTicketTiers = (ticketTiers ?? []).length > 0;
  const hasNomineeCategories = activeCategories.length > 0;
  const explicitType = eventMeta?.event_type ?? (event as any).event_type;
  const isTicketOnly = explicitType === "ticketing" || (hasTicketTiers && !hasNomineeCategories);
  const venueReady = Boolean(eventMeta?.venue_name || event.venue_name);

  const hasPaidTiers = activeTiers.some((tier: any) => Number(tier.price_minor) > 0);
  const ticketPaymentReady = !hasPaidTiers || paidCheckoutReady === true;

  const publishReady = isTicketOnly
    ? datesReady && tiersReady && venueReady && ticketPaymentReady
    : datesReady &&
      activeCategories.length > 0 &&
      allCategoriesHaveNominees &&
      checkoutReady &&
      verificationReady &&
      ticketPaymentReady &&
      !categoriesError &&
      !nomineeError;

  const publishChecks = isTicketOnly
    ? [
        { label: "Event dates are valid and close in the future", complete: datesReady, section: "tickets" },
        { label: "Venue is specified", complete: venueReady, section: "tickets" },
        { label: "Add at least one active ticket tier", complete: tiersReady, section: "tickets" },
        ...(hasPaidTiers
          ? [{ label: "Paystack settlement connected (10% platform fee)", complete: ticketPaymentReady, section: "tickets" }]
          : []),
        { label: "Event poster / flyer image added (optional)", complete: Boolean(event.image_path), optional: true, section: "tickets" },
      ]
    : [
        { label: verificationReadiness?.message ?? "Voter verification is ready", complete: verificationReady, section: "voting" },
        { label: "Voting dates are valid and close in the future", complete: datesReady, section: "details", editor: true },
        {
          label: event.voting_mode === "free" ? "A selectable voting rule is set" : "Payment checkout is connected (10% platform fee)",
          complete: checkoutReady, section: "voting", editor: true,
        },
        ...(hasPaidTiers
          ? [{ label: "Ticketing payment connected (10% platform fee)", complete: ticketPaymentReady, section: "tickets" }]
          : []),
        { label: "Add at least one category", complete: activeCategories.length > 0, section: "nominees" },
        { label: "Add a nominee to each category", complete: allCategoriesHaveNominees, section: "nominees" },
        { label: "Event cover image added (optional)", complete: Boolean(event.image_path), optional: true, section: "details" },
      ];

  const publicUrl = `/events/${event.slug}`;
  const imagePaths =
    nominees?.map((nominee) => nominee.image_path).filter((path): path is string => Boolean(path)) ?? [];
  const { data: signedImages } = imagePaths.length
    ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600)
    : { data: [] };
  const imageUrlByPath = new Map(
    (signedImages ?? []).flatMap((image) =>
      image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []
    )
  );
  const imageUrlMap: Record<string, string> = Object.fromEntries(imageUrlByPath);

  const { data: eventImage } = event.image_path
    ? await supabase.storage.from("nominee-images").createSignedUrl(event.image_path, 3600)
    : { data: null };

  const requiredChecks = publishChecks.filter(check => !check.optional);
  const nextStep = eventNextStep({
    status: event.status,
    expired: permissions.expired,
    scheduled: Date.parse(event.starts_at) > requestTime,
    datesReady,
    categoryCount: activeCategories.length,
    nomineesReady: allCategoriesHaveNominees,
    checkoutReady,
    verificationReady,
    votingMode: event.voting_mode,
    canReopen: permissions.reopen,
    organizationId,
    isTicketOnly,
    tiersReady,
    venueReady,
  });
  const panel = "rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-100 sm:p-6";
  const whatsappConfigured = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_BUSINESS_TOKEN);
  const returnToDraft = permissions.returnToDraft ? <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
    <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200">{event.status === "pending_review" ? "Change your event before approval" : "Need to change competition settings?"}</h3>
    <p className="text-sm text-amber-900 dark:text-amber-300">{event.status === "pending_review" ? "Withdraw your event from review, edit it, then submit it again." : "Full editing removes your event from the public listing and clears approval. After editing, submit it for approval again."}</p>
    <EventStatusForm eventId={eventId} action="unpublish" backTo={pagePath} label={event.status === "pending_review" ? "Withdraw and edit" : "Continue to full editing"} confirmMessage={event.status === "pending_review" ? "Withdraw this event from review? Your saved details stay intact. Submit it again after editing." : "Remove this event from the public listing and make it private for editing? Approval will be cleared. Submit it again after editing."} />
  </div> : null;

  return <main className="min-h-screen bg-stone-50/60 pb-20 transition-colors dark:bg-[#080b09]">
    <DashboardHeader organizationId={organizationId} />
    <div className="mx-auto max-w-5xl space-y-6 px-4 pt-6 sm:px-6">
      <header className="space-y-3">
        <Link href={`/organizer/${organizationId}/events`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-600 hover:text-emerald-900 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:text-emerald-400"><Icon name="arrowLeft" size={15} />Back to {organization?.name ?? "events"}</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-words font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 sm:text-3xl">{event.name}</h1>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-mono text-xs font-semibold text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-850">{presentation.label}</span>
        </div>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-mono">{ghanaDate(event.starts_at)} → {ghanaDate(event.ends_at)} · Ghana GMT</p>
      </header>
      {presentation.warning && event.status !== "pending_review" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">{presentation.warning}</p>}
      {!canManage && <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300">This workspace is read-only for your current access.</p>}
      {workspace?.review_feedback && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"><strong>Changes requested: </strong>{workspace.review_feedback}<a href="#review-feedback" className="ml-2 font-semibold border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:text-stone-200">Read feedback</a></div>}
      <EventWorkspace
        isTicketOnly={isTicketOnly}
        tickets={
          <TicketTiersManager
            eventId={eventId}
            organizationId={organizationId}
            initialTiers={(ticketTiers as any) ?? []}
            eventName={event.name}
            eventDescription={event.description}
            startsAt={event.starts_at}
            endsAt={event.ends_at}
            venueName={eventMeta?.venue_name || event.venue_name}
            venueAddress={eventMeta?.venue_address}
            doorsOpenTime={eventMeta?.doors_open_time || event.doors_open_time}
            isPendingReview={event.status === "pending_review"}
            returnToDraftNode={returnToDraft}
            coverImage={
              permissions.editCover ? (
                <EventImageForm
                  eventId={eventId}
                  eventName={event.name}
                  initialPath={event.image_path}
                  initialUrl={eventImage?.signedUrl ?? null}
                  backTo={pagePath}
                />
              ) : eventImage?.signedUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-xs aspect-21/9 min-h-[160px] sm:min-h-[220px] dark:border-[#1c2721] dark:bg-[#080b09]">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url("${eventImage.signedUrl}")` }}
                    role="img"
                    aria-label={`${event.name} cover`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent flex items-end p-4 sm:p-6">
                    <span className="text-white font-serif font-bold text-base sm:text-xl drop-shadow-sm truncate">
                      {event.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-stone-900 via-stone-850 to-emerald-950 p-6 text-white shadow-inner sm:p-8 dark:border-emerald-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-block rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-mono font-bold tracking-widest text-amber-300 uppercase">
                        Digital Ticket Pass Preview
                      </span>
                      <h4 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-sm">
                        {event.name}
                      </h4>
                      <p className="text-xs text-stone-300 font-mono">
                        {eventMeta?.venue_name || event.venue_name ? `${eventMeta?.venue_name || event.venue_name} · ` : ""}
                        {ghanaDate(event.starts_at)}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2 text-xs font-semibold text-amber-300">
                      <span>🎟 Default VoteCast Pass Artwork</span>
                    </div>
                  </div>
                  <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-stone-400">
                    No custom banner uploaded. Attendees receive this standard pass styling. {event.status === "pending_review" ? "Withdraw your event to make changes or upload custom artwork." : ""}
                  </p>
                </div>
              )
            }
          />
        }
        guided={!isTicketOnly && canManage && event.status === "draft" ? { initialSection: requestedStep === "nominees" ? "nominees" : "details", nomineesReady: allCategoriesHaveNominees && !categoriesError && !nomineeError, votingReady: checkoutReady && verificationReady } : undefined}
        nextStep={canManage ? nextStep : undefined}
        progress={canManage && event.status === "draft" ? { completed: requiredChecks.filter(check => check.complete).length, total: requiredChecks.length } : undefined}
        canEdit={permissions.editDraft || permissions.editPublic || (canManage && event.status === "pending_review")}
        canManageVoting={canManage && event.status !== "archived"}
        viewLink={<div className="flex flex-wrap items-center gap-2">
          {["draft", "pending_review"].includes(event.status) ? (
            <Link
              href={`${pagePath}/preview`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-[#141b16]"
            >
              <span>Preview event</span> ↗
            </Link>
          ) : ["published", "paused", "closed"].includes(event.status) ? (
            <Link
              href={publicUrl}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-[#141b16]"
            >
              <span>View event page</span> ↗
            </Link>
          ) : null}
          <Link href="/gate" target="_blank" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"><span>📱 Gate Scanner</span> ↗</Link>
        </div>}
        editor={<>
          {permissions.editDraft ? <EventDetailsForm key={event.id + "-draft"} eventId={eventId} organizationId={organizationId} smsBalance={typeof smsBalance === "number" ? smsBalance : null} initial={{ name: event.name, description: event.description, price: Number(event.unit_price_minor), startsAt: event.starts_at, endsAt: event.ends_at, resultsVisibility: event.results_visibility, votingMode: event.voting_mode, verificationMethod, votingRule: isVotingRule(event.voting_rule) ? event.voting_rule : "category_limit", freeVoteLimit: event.free_vote_limit_per_phone, votingRules: event.voting_rules, eventType: ((eventMeta?.event_type ?? event.event_type) as any) ?? "voting", venueName: event.venue_name, doorsOpenTime: event.doors_open_time }} /> : permissions.editPublic ? <PublicEventEditor key={event.id} event={event} permissions={permissions} /> : <p className="text-sm text-stone-600">Details are protected while your event is awaiting approval.</p>}
          {returnToDraft}
          {!permissions.returnToDraft && permissions.editPublic && event.status !== "closed" && <p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-600">Competition settings stay fixed while published. Full editing requires no voting or payment history and owner/admin access.</p>}
        </>}
        details={<>
          {event.status !== "draft" && <section className={panel}><h2 className="text-lg font-semibold text-stone-900">Event details</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-600">{event.description || "Add a description to introduce your event to voters."}</p>
            <dl className="mt-5 grid gap-4 border-t border-stone-100 pt-4 text-sm sm:grid-cols-2"><div><dt className="text-stone-500">Voting</dt><dd className="mt-1 font-semibold text-stone-900">{event.voting_mode === "paid" ? `Paid · GH₵${(event.unit_price_minor / 100).toFixed(2)} per vote` : "Free voting"}</dd></div><div><dt className="text-stone-500">Results</dt><dd className="mt-1 font-semibold capitalize text-stone-900">{event.results_visibility.replace(/_/g, " ")}</dd></div></dl>
          </section>}
          <section className={panel}><h2 className="text-lg font-semibold text-stone-900">Cover image</h2><p className="mb-4 mt-1 text-sm text-stone-600">{event.status === "pending_review" ? "Withdraw from review to change the cover image." : "Shown on your voter page and the event directory."}</p>{permissions.editCover ? <EventImageForm eventId={eventId} eventName={event.name} initialPath={event.image_path} initialUrl={eventImage?.signedUrl ?? null} backTo={pagePath} /> : eventImage?.signedUrl ? <div className="h-48 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${eventImage.signedUrl}")` }} role="img" aria-label={`${event.name} cover`} /> : <p className="text-sm text-stone-500">No cover image added.</p>}</section>
          {canManage && event.status !== "archived" && <VoterHelpSettings eventId={eventId} email={eventMeta?.voter_help_email ?? null} />}
          {["published", "paused", "closed"].includes(event.status) && <><EventPromotionTools name={event.name} url={absoluteUrl(publicUrl)} endsAt={event.ends_at} phase={event.status === "closed" || permissions.expired ? "ended" : event.status === "paused" ? "paused" : Date.parse(event.starts_at) > requestTime ? "scheduled" : "open"} /><CorrectionRequestHistory eventId={eventId} /></>}
        </>}
        nominees={<section className={panel}>{categoriesError || nomineeError ? <p role="alert" className="text-sm text-red-800">Categories or nominees could not load. Refresh to try again.</p> : <><CategoryNomineeStudio categories={categories ?? []} nominees={nominees ?? []} imageUrlMap={imageUrlMap} eventId={eventId} canManage={canManage} isDraft={event.status === "draft"} pagePath={pagePath} />{event.status !== "draft" && <div className="mt-5 border-t border-stone-100 pt-4"><p className="mb-3 text-sm text-stone-600">Categories and nominees are protected outside private editing.</p>{returnToDraft}</div>}</>}</section>}
        review={event.status === "draft" ? <section className={`${panel} space-y-6 transition-colors dark:border-[#1c2721] dark:bg-[#0c120e]`}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4 dark:border-[#1c2721]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">
                  [ 04 // LAUNCH PRE-FLIGHT ]
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                  publishReady
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${publishReady ? "bg-emerald-600 dark:bg-emerald-400" : "bg-amber-600 dark:bg-amber-400"}`} />
                  {requiredChecks.filter(c => c.complete).length} of {requiredChecks.length} Ready
                </span>
              </div>
              <h2 className="mt-1 font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Review & Submit for Approval
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {isTicketOnly
                  ? "Verify your venue, schedule, and ticket tiers before submitting to our compliance team."
                  : "Verify your competition rules and contestant roster before sending to our compliance team."}
              </p>
            </div>
            <Link
              href={`${pagePath}/preview`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-800 hover:bg-stone-50 shadow-2xs dark:border-[#223028] dark:bg-[#141b16] dark:text-stone-200 dark:hover:bg-[#1c2721]"
            >
              <span>{isTicketOnly ? "Preview Ticket Page" : "Preview Ballot"}</span> ↗
            </Link>
          </div>

          {/* Pre-Flight Checklist */}
          <div className="space-y-3">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              [ READINESS CHECKLIST // COMPLIANCE ]
            </h3>
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-stone-50/50 dark:divide-[#1c2721] dark:border-[#1c2721] dark:bg-[#141b16]/30">
              {publishChecks.map((item) => (
                <div key={item.label} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      item.complete ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    }`}>
                      {item.complete ? "✓" : "!"}
                    </span>
                    <span className={`font-semibold ${item.complete ? "text-stone-800 dark:text-stone-200" : "text-amber-950 dark:text-amber-300"}`}>
                      {item.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.complete ? (
                      <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded dark:bg-emerald-950/60 dark:border-emerald-900/50 dark:text-emerald-300">
                        READY
                      </span>
                    ) : (
                      <>
                        <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded dark:bg-amber-950/60 dark:border-amber-900/50 dark:text-amber-300">
                          {item.optional ? "OPTIONAL" : "ACTION NEEDED"}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            data-workspace-section={item.section}
                            data-workspace-editor={item.editor ? "true" : "false"}
                            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-900 hover:bg-stone-50 shadow-2xs cursor-pointer dark:border-[#223028] dark:bg-[#0c120e] dark:text-emerald-300"
                          >
                            {item.optional ? "Add cover" : "Fix now →"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connected Channels Summary */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5 dark:border-[#1c2721] dark:bg-[#0c120e]">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              {isTicketOnly ? "[ TICKETING ACCESS CHANNELS ]" : "[ ACTIVE VOTING CHANNELS ]"}
            </h3>
            {isTicketOnly ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 block">🌐 Web Pass Checkout</span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-400">MoMo & Card Paystack</span>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 block">💬 SMS & PAX Codes</span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-400">Auto-generated #PAX</span>
                </div>
                <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20">
                  <span className="font-bold text-sky-950 dark:text-sky-300 block">📱 Gate Scanner</span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-400">/gate camera check-in</span>
                </div>
                <div className="p-3 rounded-xl border border-stone-200 bg-stone-50 dark:border-[#223028] dark:bg-[#141b16]">
                  <span className="font-bold text-stone-800 dark:text-stone-200 block">🔍 Pass Retrieval</span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">/tickets self-service</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 block">🌐 Web Voting</span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-400">Instant mobile link</span>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 block">💬 WhatsApp Bot</span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-400">+233 59 299 2566</span>
                </div>
                <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20">
                  <span className="font-bold text-sky-950 dark:text-sky-300 block">✈️ Telegram Bot</span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-400">@VotecastHubGH_bot</span>
                </div>
                <div className="p-3 rounded-xl border border-stone-200 bg-stone-50 dark:border-[#223028] dark:bg-[#141b16]">
                  <span className="font-bold text-stone-800 dark:text-stone-200 block">📞 USSD (*920#)</span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    {ussdError ? "Unavailable" : ussdRequest?.enabled ? "Enabled" : "Optional add-on"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Account connection callout if Paid */}
          {event.voting_mode === "paid" && !checkoutReady && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">Payment Account Required for Paid Voting</p>
              <p className="text-[11px] text-amber-900 dark:text-amber-300">
                Before submitting for approval, connect your organization's Paystack mobile money settlement account.
              </p>
              <Link
                href={`/organizer/${organizationId}/payments`}
                className="inline-flex min-h-9 items-center rounded-lg bg-amber-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-800 shadow-2xs"
              >
                Set up Paystack Account →
              </Link>
            </div>
          )}

          {/* Platform Review Notice */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-300 font-bold">
              <span>🛡️</span>
              <span>Platform Compliance & Verification</span>
            </div>
            <p className="text-[11px] text-emerald-900/90 dark:text-emerald-300/90 leading-relaxed">
              Our team reviews contest integrity, fair voting parameters, and settlement routing. Submissions are typically reviewed and approved within <strong>1–2 hours</strong> during Ghana business hours. Once approved, voting will open on your scheduled start date.
            </p>
          </div>

          {/* Submit Action */}
          {canManage && (
            <div className="pt-2">
              <EventStatusForm
                eventId={eventId}
                action="publish"
                backTo={pagePath}
                label="Submit Event for Approval"
                disabled={!publishReady}
                disabledMessage={
                  isTicketOnly
                    ? "Add at least one active ticket tier and venue in the Tickets tab to enable submission."
                    : "Please complete all required items in the checklist above."
                }
                confirmMessage={`Submit “${event.name}” for platform approval? It will remain private until approved, and ${isTicketOnly ? "ticket sales" : "voting"} will open automatically on your scheduled start date.`}
              />
            </div>
          )}
        </section> : undefined}
        voting={<>
          <UssdPaymentHistory eventId={eventId}/>
          {event.status === "draft" ? (
            <details className="group rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e]">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-mono font-bold tracking-wider uppercase text-stone-700 dark:text-stone-300">
                <span className="flex items-center gap-2">
                  <span>[ CHANNELS & TELCO PREVIEW // WHATSAPP · TELEGRAM · USSD ]</span>
                </span>
                <span className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-stone-600 transition-transform group-open:rotate-180 dark:border-[#223028] dark:bg-[#141b16] dark:text-stone-300">
                  ▼
                </span>
              </summary>
              <div className="mt-5 space-y-5 border-t border-stone-100 pt-5 dark:border-[#1c2721]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <WhatsAppVotingInfo
                    eventCode={ussdRequest?.event_code}
                    eventSlug={event.slug}
                    eventName={event.name}
                    votingMode={event.voting_mode}
                    eventStatus={event.status}
                    configured={whatsappConfigured}
                  />
                  <TelegramVotingInfo
                    eventSlug={event.slug}
                    eventName={event.name}
                    votingMode={event.voting_mode}
                    eventStatus={event.status}
                  />
                </div>
                <UssdRequest eventId={eventId} quote={ussdRequest} canAccept={["owner", "admin"].includes(membership?.role ?? "") && !["closed", "archived"].includes(event.status) && Date.parse(event.ends_at) > requestTime} requested={Boolean(ussdRequest && ussdRequest.status !== "cancelled")} unavailable={Boolean(ussdError)} canRequest={canManage && !["closed", "archived"].includes(event.status) && Date.parse(event.ends_at) > requestTime} />
              </div>
            </details>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <WhatsAppVotingInfo
                  eventCode={ussdRequest?.event_code}
                  eventSlug={event.slug}
                  eventName={event.name}
                  votingMode={event.voting_mode}
                  eventStatus={event.status}
                  configured={whatsappConfigured}
                />
                <TelegramVotingInfo
                  eventSlug={event.slug}
                  eventName={event.name}
                  votingMode={event.voting_mode}
                  eventStatus={event.status}
                />
              </div>
              <UssdRequest eventId={eventId} quote={ussdRequest} canAccept={["owner", "admin"].includes(membership?.role ?? "") && !["closed", "archived"].includes(event.status) && Date.parse(event.ends_at) > requestTime} requested={Boolean(ussdRequest && ussdRequest.status !== "cancelled")} unavailable={Boolean(ussdError)} canRequest={canManage && !["closed", "archived"].includes(event.status) && Date.parse(event.ends_at) > requestTime} />
            </>
          )}
          {event.status === "draft" && event.voting_mode === "paid" && !checkoutReady && (
            <section className={`${panel} mt-5`}>
              <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100">Connect your payment account</h2>
              <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400">A verified payment account is needed before this paid event can be submitted.</p>
              <Link href={`/organizer/${organizationId}/payments`} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 dark:border-[#223028] dark:bg-[#141b16] dark:text-emerald-300">Set up payments</Link>
            </section>
          )}
          {event.status !== "draft" && <section className={panel}><h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Manage voting</h2><p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{event.status === "closed" ? "This event is permanently closed and cannot reopen." : event.status === "archived" ? "This event is archived. Its history is preserved." : event.status === "pending_review" ? "Your event stays private until approval." : event.status === "draft" ? "Check your voting rules and voter access method here. When setup is ready, use Review & Submit." : permissions.expired ? "The voting deadline has passed. Existing votes are preserved." : event.status === "paused" ? "Voting is paused. Resume when you are ready." : "Voting follows the opening and closing times shown above."}</p>
            <div className="mt-4 flex flex-wrap gap-3">{permissions.pause && <EventStatusForm eventId={eventId} action="pause" backTo={pagePath} label="Pause voting" />}{permissions.resume && <EventStatusForm eventId={eventId} action="resume" backTo={pagePath} label="Resume voting" />}</div>
            {permissions.extend && <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-emerald-900 border border-stone-300 bg-white shadow-xs rounded-xl px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Extend deadline / edit schedule</summary><PublicEventEditor key={event.id} event={event} permissions={permissions} scheduleOnly /></details>}
            {permissions.reopen && <div className="mt-5 border-t border-stone-100 pt-5"><ReopenEventForm eventId={eventId} /></div>}

          </section>}
          {event.status !== "draft" && <section className={panel}><h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Voting settings</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-stone-500">Voter verification</dt><dd className="mt-1 font-semibold capitalize">{verificationMethod.replace(/_/g, " ")}</dd></div><div><dt className="text-stone-500">Voting rule</dt><dd className="mt-1 font-semibold capitalize">{event.voting_rule.replace(/_/g, " ")}</dd></div></dl><p className="mt-4 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-400">{event.voting_rules || "No additional voter instructions."}</p>{returnToDraft}</section>}
          {canManage && event.voting_mode === "free" && event.status !== "archived" && (verificationMethod === "invite_code" ? <AccessCodeManager eventId={eventId} /> : verificationMethod === "voter_list" ? <VoterListManager eventId={eventId} categoryCount={activeCategories.length} onePerCategory={event.voting_rule === "one_per_category"} /> : null)}

        </>}
      />
      {/* Review Feedback and Messages - placed before Danger Zone */}
      {(event.status !== "draft" || workspace?.last_review_kind || workspace?.review_feedback) && (
        <EventReviewConversation eventId={eventId} canReply={canManage && event.status !== "archived"} />
      )}

      {/* Danger Zone: Discard Draft / Close or Delete Event */}
      {canManage && (
        event.status === "draft" ? (
          <details className="group rounded-2xl border border-red-200/80 bg-red-50/40 p-4 transition-all dark:border-red-900/40 dark:bg-red-950/20">
            <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-red-800 hover:text-red-950 dark:text-red-300 dark:hover:text-red-200">
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-red-100 text-red-700 text-[11px] font-bold dark:bg-red-900/60 dark:text-red-300">
                  ✕
                </span>
                <span>Discard Draft Event</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-md transition-transform group-open:rotate-180 dark:bg-red-900/60 dark:text-red-300">
                ▼
              </span>
            </summary>
            <div className="mt-4 border-t border-red-200/60 pt-4 dark:border-red-900/40 space-y-3">
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                Permanently delete this draft event. This action cannot be undone.
              </p>
              {canRemove ? (
                <DeleteEventForm eventId={eventId} name={event.name} />
              ) : (
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Only an organization owner or admin can discard this event draft.
                </p>
              )}
            </div>
          </details>
        ) : (
          <section className={panel} aria-labelledby="event-ending-actions">
            <h2 id="event-ending-actions" className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
              Close or delete your event
            </h2>
            <div className="mt-4 space-y-4">
              {["published", "paused"].includes(event.status) && (
                <>
                  <p className="text-sm leading-6 text-stone-600 dark:text-stone-400">
                    Close the event when you’re finished. Voting stops and cannot reopen. You can then keep the results or delete the event.
                  </p>
                  <EventStatusForm eventId={eventId} action="close" backTo={pagePath} label="Close event" confirmMessage="Close this event? Voting will stop and cannot reopen. Results and payments remain available until you choose to delete the event." />
                </>
              )}
              {canRemove && ["draft", "pending_review", "closed", "archived"].includes(event.status) && (
                <>
                  <p className="text-sm leading-6 text-stone-600 dark:text-stone-400">
                    Delete this event to remove it immediately. Unfinished checkouts won’t block deletion. Payment records remain in Payments.
                  </p>
                  <DeleteEventForm eventId={eventId} name={event.name} />
                </>
              )}
              {!canRemove && ["draft", "pending_review", "closed", "archived"].includes(event.status) && (
                <p className="text-sm text-stone-600 dark:text-stone-400">An organization owner or admin can delete this event.</p>
              )}
            </div>
          </section>
        )
      )}
    </div>
  </main>;
}
