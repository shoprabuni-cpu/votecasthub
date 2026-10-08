import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventImageForm } from "@/components/events/event-image-form";
import { EventStatusForm } from "@/components/events/event-status-form";
import { Icon } from "@/components/icon";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { CorrectionRequestForm, ReopenEventForm } from "@/components/events/fairness-controls";
import { CorrectionRequestHistory } from "@/components/events/correction-history";
import { PublicEventEditor } from "@/components/events/public-event-editor";
import { DeleteEventForm } from "@/components/events/delete-event-form";
import { AccessCodeManager } from "@/components/events/access-code-manager";
import { isVotingRule } from "@/lib/voting-rules";
import { VoterListManager } from "@/components/events/voter-list-manager";
import { EventReviewSummary } from "@/components/events/event-review-summary";
import { CategoryNomineeStudio } from "@/components/events/category-nominee-studio";
import { EventReviewConversation } from "@/components/events/review-conversation";
import { organizerEventPresentation, type EventWorkspaceState } from "@/lib/events/organizer-presentation";
import { EventEditDrawer } from "@/components/events/event-edit-drawer";

export const metadata: Metadata = { title: "Event Setup Studio · VoteHub" };
type Props = { params: Promise<{ organizationId: string; eventId: string }> };
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
  image_path: string | null;
};

export default async function EventSetupPage({ params }: Props) {
  const { organizationId, eventId } = await params;
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(eventId)) notFound();
  const { supabase, userId } = await requireVerifiedUser();

  const [
    { data: eventRows, error: eventError },
    { data: membership, error: membershipError },
    { data: categories, error: categoriesError },
    { data: organization },
    { data: smsBalance },
    { data: eventMeta },
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
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_sms_balance", { p_org: organizationId }),
    supabase.from("events").select("verification_method").eq("id", eventId).maybeSingle(),
  ]);

  const verificationMethod = (eventMeta?.verification_method ?? "phone") as "phone" | "email" | "invite_code" | "voter_list";

  const typedEventRows = (eventRows ?? []) as OrganizationEvent[];
  if (eventError || membershipError) {
    return (
      <main className="min-h-screen bg-stone-50/60 pb-16">
        <DashboardHeader organizationId={organizationId} />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-10 text-center">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-xs">
            <h1 className="text-lg font-serif font-semibold text-stone-900">We could not load this event.</h1>
            <p className="mt-1 text-xs text-stone-500">Refresh the page or try again shortly.</p>
            <Link
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline"
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

  const canManage = ["owner", "admin", "editor"].includes(membership?.role ?? "");
  const canRemove = ["owner", "admin"].includes(membership?.role ?? "");
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
  const canReturnToDraft = Boolean(workspace && !workspace.has_activity && ["pending_review", "published", "paused"].includes(event.status));
  const votingRulesReady =
    event.voting_mode === "free" &&
    isVotingRule(event.voting_rule) &&
    (event.voting_rule !== "one_per_category" || event.free_vote_limit_per_phone === 1);
  const checkoutReady = event.voting_mode === "paid" ? paidCheckoutReady === true : votingRulesReady;
  const { data: verificationReadiness, error: verificationReadinessError } = await supabase.rpc("get_event_verification_readiness", { p_event_id: eventId });
  const verificationReady = !verificationReadinessError && verificationReadiness?.ready === true;
  const publishReady =
    datesReady &&
    activeCategories.length > 0 &&
    allCategoriesHaveNominees &&
    checkoutReady &&
    verificationReady &&
    !categoriesError &&
    !nomineeError;

  const publishChecks = [
    { label: verificationReadiness?.message ?? "Voter verification configuration is available", complete: verificationReady },
    { label: "Voting dates are valid and close in the future", complete: datesReady },
    {
      label: event.voting_mode === "free" ? "A selectable voting rule is set" : "Payment checkout is connected",
      complete: checkoutReady,
    },
    { label: "At least one category is visible to voters", complete: activeCategories.length > 0 },
    { label: "Every active category has an active nominee", complete: allCategoriesHaveNominees },
    { label: "Event cover image added (optional)", complete: Boolean(event.image_path), optional: true },
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

  return (
    <main className="min-h-screen bg-stone-50/60 pb-20">
      <DashboardHeader organizationId={organizationId} />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 space-y-8">
        {/* Notices */}
        {presentation.warning && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{presentation.warning}</p>}
        {workspace?.review_feedback && <p className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-stone-800"><strong>Platform feedback: </strong>{workspace.review_feedback} <a className="font-semibold text-emerald-800 underline" href="#review-feedback">View conversation</a></p>}
        {/* Top Breadcrumb & Status Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href={`/organizer/${organizationId}/events`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-emerald-900 transition-colors"
            >
              <Icon name="arrowLeft" size={13} />
              <span>Back to {organization?.name ?? "Events"}</span>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-serif font-medium text-stone-900 tracking-tight">
                {event.name}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                  event.status === "published"
                    ? "bg-emerald-100 text-emerald-800"
                    : event.status === "paused"
                    ? "bg-amber-100 text-amber-800"
                    : event.status === "closed"
                    ? "bg-stone-200 text-stone-700"
                    : "bg-stone-100 text-stone-600 border border-stone-200"
                }`}
              >
                {presentation.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && event.status === "draft" && (
              <EventEditDrawer
                eventId={eventId}
                organizationId={organizationId}
                smsBalance={typeof smsBalance === "number" ? smsBalance : null}
                initial={{
                  name: event.name,
                  description: event.description,
                  price: Number(event.unit_price_minor),
                  startsAt: event.starts_at,
                  endsAt: event.ends_at,
                  resultsVisibility: event.results_visibility,
                  votingMode: event.voting_mode,
                  verificationMethod: verificationMethod,
                  votingRule: isVotingRule(event.voting_rule) ? event.voting_rule : "category_limit",
                  freeVoteLimit: event.free_vote_limit_per_phone,
                  votingRules: event.voting_rules,
                }}
              />
            )}
            {event.status === "draft" && (
              <Link
                href={`${pagePath}/preview`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all cursor-pointer"
              >
                <Icon name="eye" size={14} />
                <span>Preview Ballot ↗</span>
              </Link>
            )}
            {["published", "paused", "closed"].includes(event.status) && (
              <Link
                href={publicUrl}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all cursor-pointer"
              >
                <span>View Public Page ↗</span>
              </Link>
            )}
          </div>
        </div>

        {categoriesError || nomineeError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-900">
            Some event details could not be loaded. Refresh the page to try again.
          </div>
        ) : (
          <>
            {/* Event Info Summary card (draft mode) */}
            {event.status === "draft" && (
              <section className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                      <Icon name="calendar" size={13} />
                      <span>Event Details</span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                      Voting window, rules, and verification settings for this draft.
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 border-t border-stone-100 pt-4 text-xs">
                  <div>
                    <dt className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Opens</dt>
                    <dd className="mt-0.5 font-semibold text-stone-800 font-mono text-[11px]">
                      {new Date(event.starts_at).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Closes</dt>
                    <dd className="mt-0.5 font-semibold text-stone-800 font-mono text-[11px]">
                      {new Date(event.ends_at).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Voting Mode</dt>
                    <dd className="mt-0.5 font-semibold text-stone-800 capitalize">
                      {event.voting_mode === "paid" ? "Paid (Paystack)" : "Free"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Verification</dt>
                    <dd className="mt-0.5 font-semibold text-stone-800 capitalize">
                      {verificationMethod.replace(/_/g, " ")}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <dt className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Results Visibility</dt>
                    <dd className="mt-0.5 font-semibold text-stone-800 capitalize">
                      {event.results_visibility.replace(/_/g, " ")}
                    </dd>
                  </div>
                  {event.description && (
                    <div className="col-span-2 sm:col-span-2">
                      <dt className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Description</dt>
                      <dd className="mt-0.5 text-stone-600 leading-relaxed line-clamp-2">{event.description}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Event Cover Banner */}
            <section className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-7 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                    <Icon name="image" size={13} />
                    <span>Event Cover Banner</span>
                  </div>
                  <h3 className="text-lg font-serif font-medium text-stone-900 tracking-tight">
                    Set your public artwork
                  </h3>
                  <p className="text-xs text-stone-500">
                    This image appears as the banner of your voting page and in the public directory.
                  </p>
                </div>
              </div>

              {event.status !== "archived" && canManage ? (
                <EventImageForm
                  eventId={eventId}
                  eventName={event.name}
                  initialPath={event.image_path}
                  initialUrl={eventImage?.signedUrl ?? null}
                  backTo={pagePath}
                />
              ) : eventImage?.signedUrl ? (
                <div
                  className="h-48 w-full rounded-xl bg-cover bg-center border border-stone-200"
                  style={{ backgroundImage: `url("${eventImage.signedUrl}")` }}
                  role="img"
                  aria-label={`${event.name} cover image`}
                />
              ) : (
                <p className="text-xs text-stone-400">No cover image has been added.</p>
              )}
            </section>

            {/* Step 2: Categories and Nominees Studio */}
            <section className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-7 shadow-xs">
              <CategoryNomineeStudio
                categories={categories ?? []}
                nominees={nominees ?? []}
                imageUrlMap={imageUrlMap}
                eventId={eventId}
                canManage={canManage}
                isDraft={event.status === "draft"}
                pagePath={pagePath}
              />
            </section>

            {/* Public Event Editor & Fairness Controls (for published events) */}
            {canManage && ["published", "paused", "closed"].includes(event.status) && (
              <div className="space-y-6">
                <PublicEventEditor
                  event={event}
                  startLocked={Date.parse(event.starts_at) <= requestTime || Boolean(workspace?.has_activity)}
                  expired={Date.parse(event.ends_at) <= requestTime}
                />
                <CorrectionRequestForm eventId={eventId} />
                <CorrectionRequestHistory eventId={eventId} />
                {canRemove && ["published", "paused"].includes(event.status) && Date.parse(event.ends_at) <= requestTime && (
                  <ReopenEventForm eventId={eventId} />
                )}
              </div>
            )}

            {/* Private Voter Access Management */}
            {canManage && (
              verificationMethod === "invite_code" ? (
                <AccessCodeManager eventId={eventId} />
              ) : verificationMethod === "voter_list" ? (
                <VoterListManager eventId={eventId} />
              ) : event.status === "draft" ? (
                <details className="group rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all">
                  <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-emerald-900 group-open:border-b group-open:border-stone-100 group-open:pb-3">
                    <div className="flex items-center gap-2">
                      <Icon name="shield" size={15} />
                      <span>Private Voter Access Controls (Optional)</span>
                    </div>
                    <span className="text-[11px] text-stone-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="pt-4 space-y-6">
                    <AccessCodeManager eventId={eventId} />
                    <VoterListManager eventId={eventId} />
                  </div>
                </details>
              ) : null
            )}

            {/* Step 4: Pre-Launch Readiness Review */}
            {event.status === "draft" && (
              <EventReviewSummary
                datesReady={datesReady}
                name={event.name}
                startsAt={event.starts_at}
                endsAt={event.ends_at}
                votingMode={event.voting_mode}
                categoryCount={activeCategories.length}
                nomineeCount={nominees?.filter((nominee) => nominee.is_active).length ?? 0}
                allCategoriesHaveNominees={allCategoriesHaveNominees}
                checkoutReady={checkoutReady}
                smsReady={true}
                imageAdded={Boolean(event.image_path)}
              />
            )}

            {/* Final Launchpad & Publishing Panel */}
            <section className="rounded-2xl border border-stone-200/90 bg-gradient-to-br from-stone-50 via-white to-stone-50 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="max-w-xl">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                    <Icon name="sparkle" size={13} />
                    <span>Launchpad</span>
                  </div>
                  <h3 className="mt-1 text-xl font-serif font-medium text-stone-900 tracking-tight">
                    {event.status === "draft" ? "Submit your event for review" : "Manage active event status"}
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    Submitting sends the event to platform review. It becomes public after approval, and accepts votes during the scheduled Ghana time window.
                  </p>

                  <ul className="mt-4 space-y-2">
                    {publishChecks.map((item) => (
                      <li key={item.label} className="flex items-center gap-2 text-xs">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                            item.complete ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-500"
                          }`}
                        >
                          {item.complete ? "✓" : "·"}
                        </span>
                        <span className={item.complete ? "text-stone-800 font-medium" : "text-stone-500"}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {event.voting_mode === "paid" && !checkoutReady && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-900">
                      Connect and verify a Paystack payment account in Organization Settings before publishing.
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex flex-col gap-2 shrink-0">
                    {event.status === "draft" && (
                      <>
                        <Link
                          href={`${pagePath}/preview`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 transition-all active:scale-95 text-center"
                        >
                          <Icon name="eye" size={14} />
                          <span>Preview voter page</span>
                        </Link>
                        <EventStatusForm
                          eventId={eventId}
                          action="publish"
                          backTo={pagePath}
                          label="Submit for review"
                          disabled={!publishReady}
                          disabledMessage={
                            !datesReady ? "Update the voting dates so the closing time is in the future." : event.voting_mode === "paid" && !checkoutReady
                              ? "A verified payment provider must be connected before publishing."
                              : "Complete the required checklist items first."
                          }
                          confirmMessage={`Submit “${event.name}” for platform review? It will remain private until approved. Voting follows your scheduled Ghana dates.`}
                        />
                      </>
                    )}
                    {event.status === "published" && (
                      <div className="flex flex-col gap-2">
                        <EventStatusForm eventId={eventId} action="pause" backTo={pagePath} label="Pause Voting" />
                        <EventStatusForm
                          eventId={eventId}
                          action="close"
                          backTo={pagePath}
                          label="Close Event"
                          confirmMessage="Close this event? This action cannot be undone."
                        />
                      </div>
                    )}
                    {event.status === "paused" && (
                      <div className="flex flex-col gap-2">
                        <EventStatusForm eventId={eventId} action="resume" backTo={pagePath} label="Resume Voting" />
                        <EventStatusForm
                          eventId={eventId}
                          action="close"
                          backTo={pagePath}
                          label="Close Event"
                          confirmMessage="Close this event? This action cannot be undone."
                        />
                      </div>
                    )}
                    {event.status === "closed" && (
                      <EventStatusForm
                        eventId={eventId}
                        action="archive"
                        backTo={`/organizer/${organizationId}/events`}
                        label="Archive Event"
                        confirmMessage="Archive this event? Its votes, payments, and audit history will be preserved."
                      />
                    )}
                  </div>
                )}
              </div>
            </section>

            <EventReviewConversation eventId={eventId} canReply={canManage} />

            {/* Danger Zone */}
            {(canRemove || (canManage && event.status === "pending_review")) && event.status !== "archived" && (
              <div className="rounded-2xl border border-stone-200/60 bg-stone-50/50 p-5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-stone-800">Workspace Management</h4>
                  <p className="text-stone-500 mt-0.5">
                    Unused drafts can be deleted permanently. Events with recorded ballots must be archived to preserve history.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {event.status === "draft" && <DeleteEventForm eventId={eventId} name={event.name} />}
                  {event.status === "draft" && (
                    <EventStatusForm
                      eventId={eventId}
                      action="archive"
                      backTo={`/organizer/${organizationId}/events`}
                      label="Archive Draft"
                      confirmMessage="Move this draft to your archive?"
                    />
                  )}
                  {canReturnToDraft && (event.status === "pending_review" || canRemove) && (
                    <EventStatusForm
                      eventId={eventId}
                      action="unpublish"
                      backTo={pagePath}
                      label={event.status === "pending_review" ? "Withdraw review & edit" : "Return to draft & edit"}
                      confirmMessage="Return this unused event to draft? Approval will be cleared. Update the event and submit it for a new review."
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
