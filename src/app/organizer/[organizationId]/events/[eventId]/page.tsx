import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  voter_help_email?: string | null;
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
    supabase.from("organizations").select("name, moderation_status, archived_at").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_sms_balance", { p_org: organizationId }),
    supabase.from("events").select("verification_method, voter_help_email").eq("id", eventId).maybeSingle(),
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
  const publishReady =
    datesReady &&
    activeCategories.length > 0 &&
    allCategoriesHaveNominees &&
    checkoutReady &&
    verificationReady &&
    !categoriesError &&
    !nomineeError;

  const publishChecks = [
    { label: verificationReadiness?.message ?? "Voter verification is ready", complete: verificationReady, section: "voting" },
    { label: "Voting dates are valid and close in the future", complete: datesReady, section: "details", editor: true },
    {
      label: event.voting_mode === "free" ? "A selectable voting rule is set" : "Payment checkout is connected",
      complete: checkoutReady, section: "details", editor: true,
    },
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
  const nextStep = eventNextStep({ status: event.status, expired: permissions.expired, scheduled: Date.parse(event.starts_at) > requestTime, datesReady, categoryCount: activeCategories.length, nomineesReady: allCategoriesHaveNominees, checkoutReady, verificationReady, votingMode: event.voting_mode, canReopen: permissions.reopen, organizationId });
  const panel = "rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6";
  const returnToDraft = permissions.returnToDraft ? <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
    <h3 className="text-sm font-semibold text-amber-950">{event.status === "pending_review" ? "Change your event before approval" : "Need to change competition settings?"}</h3>
    <p className="text-sm text-amber-900">{event.status === "pending_review" ? "Withdraw your event from review, edit it, then submit it again." : "Full editing removes your event from the public listing and clears approval. After editing, submit it for approval again."}</p>
    <EventStatusForm eventId={eventId} action="unpublish" backTo={pagePath} label={event.status === "pending_review" ? "Withdraw and edit" : "Continue to full editing"} confirmMessage={event.status === "pending_review" ? "Withdraw this event from review? Your saved details stay intact. Submit it again after editing." : "Remove this event from the public listing and return it to draft? Approval will be cleared. Submit it again after editing."} />
  </div> : null;

  return <main className="min-h-screen bg-stone-50/60 pb-20">
    <DashboardHeader organizationId={organizationId} />
    <div className="mx-auto max-w-5xl space-y-6 px-4 pt-6 sm:px-6">
      <header className="space-y-3">
        <Link href={`/organizer/${organizationId}/events`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-600 hover:text-emerald-900"><Icon name="arrowLeft" size={15} />Back to {organization?.name ?? "events"}</Link>
        <div className="flex flex-wrap items-center gap-3"><h1 className="break-words font-serif text-2xl font-medium text-stone-900 sm:text-3xl">{event.name}</h1><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">{presentation.label}</span></div>
        <p className="text-sm text-stone-600">{ghanaDate(event.starts_at)} → {ghanaDate(event.ends_at)} · Ghana time</p>
      </header>
      {presentation.warning && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{presentation.warning}</p>}
      {!canManage && <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">This workspace is read-only for your current access.</p>}
      {workspace?.review_feedback && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Changes requested: </strong>{workspace.review_feedback}<a href="#review-feedback" className="ml-2 font-semibold underline">Read feedback</a></div>}
      <EventWorkspace
        nextStep={canManage ? nextStep : undefined}
        progress={canManage && event.status === "draft" ? { completed: requiredChecks.filter(check => check.complete).length, total: requiredChecks.length } : undefined}
        canEdit={permissions.editDraft || permissions.editPublic || (canManage && event.status === "pending_review")}
        canManageVoting={canManage && event.status !== "archived"}
        viewLink={event.status === "draft" ? <Link href={`${pagePath}/preview`} className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50">Preview event</Link> : ["published", "paused", "closed"].includes(event.status) ? <Link href={publicUrl} className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50">View voter page ↗</Link> : null}
        editor={<>
          {permissions.editDraft ? <EventDetailsForm key={event.id + "-draft"} eventId={eventId} organizationId={organizationId} smsBalance={typeof smsBalance === "number" ? smsBalance : null} initial={{ name: event.name, description: event.description, price: Number(event.unit_price_minor), startsAt: event.starts_at, endsAt: event.ends_at, resultsVisibility: event.results_visibility, votingMode: event.voting_mode, verificationMethod, votingRule: isVotingRule(event.voting_rule) ? event.voting_rule : "category_limit", freeVoteLimit: event.free_vote_limit_per_phone, votingRules: event.voting_rules }} /> : permissions.editPublic ? <PublicEventEditor key={event.id} event={event} permissions={permissions} /> : <p className="text-sm text-stone-600">Details are protected while your event is awaiting approval.</p>}
          {returnToDraft}
          {!permissions.returnToDraft && permissions.editPublic && event.status !== "closed" && <p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-600">Competition settings stay fixed while published. Full editing requires no voting or payment history and owner/admin access.</p>}
        </>}
        details={<>
          <section className={panel}><h2 className="text-lg font-semibold text-stone-900">Event details</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-600">{event.description || "Add a description to introduce your event to voters."}</p>
            <dl className="mt-5 grid gap-4 border-t border-stone-100 pt-4 text-sm sm:grid-cols-2"><div><dt className="text-stone-500">Voting</dt><dd className="mt-1 font-semibold text-stone-900">{event.voting_mode === "paid" ? `Paid · GH₵${(event.unit_price_minor / 100).toFixed(2)} per vote` : "Free voting"}</dd></div><div><dt className="text-stone-500">Results</dt><dd className="mt-1 font-semibold capitalize text-stone-900">{event.results_visibility.replace(/_/g, " ")}</dd></div></dl>
          </section>
          <section className={panel}><h2 className="text-lg font-semibold text-stone-900">Cover image</h2><p className="mb-4 mt-1 text-sm text-stone-600">{event.status === "pending_review" ? "Withdraw from review to change the cover image." : "Shown on your voter page and the event directory."}</p>{permissions.editCover ? <EventImageForm eventId={eventId} eventName={event.name} initialPath={event.image_path} initialUrl={eventImage?.signedUrl ?? null} backTo={pagePath} /> : eventImage?.signedUrl ? <div className="h-48 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url("${eventImage.signedUrl}")` }} role="img" aria-label={`${event.name} cover`} /> : <p className="text-sm text-stone-500">No cover image added.</p>}</section>
          {canManage && event.status !== "archived" && <VoterHelpSettings eventId={eventId} email={eventMeta?.voter_help_email ?? null} />}
          {["published", "paused", "closed"].includes(event.status) && <><EventPromotionTools name={event.name} url={absoluteUrl(publicUrl)} endsAt={event.ends_at} phase={event.status === "closed" || permissions.expired ? "ended" : event.status === "paused" ? "paused" : Date.parse(event.starts_at) > requestTime ? "scheduled" : "open"} /><CorrectionRequestHistory eventId={eventId} /></>}
        </>}
        nominees={<section className={panel}>{categoriesError || nomineeError ? <p role="alert" className="text-sm text-red-800">Categories or nominees could not load. Refresh to try again.</p> : <><CategoryNomineeStudio categories={categories ?? []} nominees={nominees ?? []} imageUrlMap={imageUrlMap} eventId={eventId} canManage={canManage} isDraft={event.status === "draft"} pagePath={pagePath} />{event.status !== "draft" && <div className="mt-5 border-t border-stone-100 pt-4"><p className="mb-3 text-sm text-stone-600">Categories and nominees are protected outside draft editing.</p>{returnToDraft}</div>}</>}</section>}
        voting={<>
          <section className={panel}><h2 className="text-lg font-semibold text-stone-900">Manage voting</h2><p className="mt-1 text-sm text-stone-600">{event.status === "closed" ? "This event is permanently closed and cannot reopen." : event.status === "archived" ? "This event is archived. Its history is preserved." : event.status === "pending_review" ? "Your event stays private until approval." : event.status === "draft" ? "Complete setup, preview your event, then submit it for approval." : permissions.expired ? "The voting deadline has passed. Existing votes are preserved." : event.status === "paused" ? "Voting is paused. Resume when you are ready." : "Voting follows the opening and closing times shown above."}</p>
            <div className="mt-4 flex flex-wrap gap-3">{permissions.pause && <EventStatusForm eventId={eventId} action="pause" backTo={pagePath} label="Pause voting" />}{permissions.resume && <EventStatusForm eventId={eventId} action="resume" backTo={pagePath} label="Resume voting" />}</div>
            {permissions.extend && <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-emerald-900">Extend deadline / edit schedule</summary><PublicEventEditor key={event.id} event={event} permissions={permissions} scheduleOnly /></details>}
            {permissions.reopen && <div className="mt-5 border-t border-stone-100 pt-5"><ReopenEventForm eventId={eventId} /></div>}
            {event.status === "draft" && <div className="mt-5 space-y-4"><ul className="space-y-2">{publishChecks.map(item => <li key={item.label} className="flex items-start gap-2 text-sm"><span className={item.complete ? "text-emerald-700" : "text-amber-700"}>{item.complete ? "✓" : "○"}</span><span className="flex flex-1 flex-wrap items-center justify-between gap-2 text-stone-700">{item.label}{!item.complete && canManage && <button type="button" data-workspace-section={item.section} data-workspace-editor={item.editor ? "true" : "false"} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-emerald-800 underline">{item.optional ? "Add image" : "Complete setup"}</button>}</span></li>)}</ul>{event.voting_mode === "paid" && !checkoutReady && <Link href={`/organizer/${organizationId}/payments`} className="text-sm font-semibold text-emerald-800 underline">Connect your payment account</Link>}{canManage && <EventStatusForm eventId={eventId} action="publish" backTo={pagePath} label="Submit for approval" disabled={!publishReady} disabledMessage="Complete the required setup items above." confirmMessage={`Submit “${event.name}” for approval? It stays private until approved. Voting follows your scheduled Ghana dates.`} />}</div>}
          </section>
          <section className={panel}><h2 className="text-lg font-semibold text-stone-900">Voting settings</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-stone-500">Voter verification</dt><dd className="mt-1 font-semibold capitalize">{verificationMethod.replace(/_/g, " ")}</dd></div><div><dt className="text-stone-500">Voting rule</dt><dd className="mt-1 font-semibold capitalize">{event.voting_rule.replace(/_/g, " ")}</dd></div></dl><p className="mt-4 whitespace-pre-wrap text-sm text-stone-600">{event.voting_rules || "No additional voter instructions."}</p>{returnToDraft}</section>
          {canManage && event.status !== "archived" && (verificationMethod === "invite_code" ? <AccessCodeManager eventId={eventId} /> : verificationMethod === "voter_list" ? <VoterListManager eventId={eventId} categoryCount={activeCategories.length} onePerCategory={event.voting_rule === "one_per_category"} /> : event.status === "draft" ? <details className={panel}><summary className="cursor-pointer text-sm font-semibold text-stone-800">Optional voter access tools</summary><div className="mt-4 space-y-5"><AccessCodeManager eventId={eventId} /><VoterListManager eventId={eventId} categoryCount={activeCategories.length} onePerCategory={event.voting_rule === "one_per_category"} /></div></details> : null)}
          {canManage && ["published", "paused", "closed", "draft"].includes(event.status) && <details className={panel}><summary className="cursor-pointer text-sm font-semibold text-stone-600">More actions</summary><div className="mt-4 space-y-4">{["published", "paused"].includes(event.status) && <><p className="text-sm text-stone-600">Permanent closure stops voting and cannot be undone. Use Pause for a temporary break.</p><EventStatusForm eventId={eventId} action="close" backTo={pagePath} label="Close permanently" confirmMessage="Permanently close this event? Voting will stop and this event cannot reopen. Existing votes and payments stay preserved." /></>}{event.status === "closed" && <EventStatusForm eventId={eventId} action="archive" backTo={`/organizer/${organizationId}/events`} label="Archive event" confirmMessage="Archive this event? Votes, payments and audit history are preserved." />}{canRemove && event.status === "draft" && <><DeleteEventForm eventId={eventId} name={event.name} /><EventStatusForm eventId={eventId} action="archive" backTo={`/organizer/${organizationId}/events`} label="Archive draft" confirmMessage="Move this draft to the archive?" /></>}</div></details>}
        </>}
      />
      <EventReviewConversation eventId={eventId} canReply={canManage && event.status !== "archived"} />
    </div>
  </main>;
}
