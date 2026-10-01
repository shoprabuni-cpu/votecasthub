import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventDetailsForm } from "@/components/events/event-details-form";
import { CategoryForm } from "@/components/events/category-form";
import { NomineeForm } from "@/components/events/nominee-form";
import { EditCategoryForm } from "@/components/events/edit-category-form";
import { EditNomineeForm } from "@/components/events/edit-nominee-form";
import { NomineeImageForm } from "@/components/events/nominee-image-form";
import { EventStatusForm } from "@/components/events/event-status-form";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Event setup" };
type Props = { params: Promise<{ organizationId: string; eventId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type OrganizationEvent = { id: string; name: string; slug: string; description: string | null; unit_price_minor: number; starts_at: string; ends_at: string; status: string; results_visibility: string; voting_mode: "free" | "paid"; free_vote_limit_per_phone: number | null; voting_rules: string | null };

export default async function EventSetupPage({ params }: Props) {
  const { organizationId, eventId } = await params;
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(eventId)) notFound();
  const { supabase, userId } = await requireVerifiedUser();
  const [{ data: eventRows, error: eventError }, { data: membership, error: membershipError }, { data: categories, error: categoriesError }, { data: organization }] = await Promise.all([
    supabase.rpc("get_organization_events", { p_organization_id: organizationId }),
    supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
    supabase.from("categories").select("id, name, description, display_order, is_active").eq("event_id", eventId).order("display_order", { ascending: true }),
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
  ]);
  const typedEventRows = (eventRows ?? []) as OrganizationEvent[];
  if (eventError || membershipError) return <main className="dashboard-page"><DashboardHeader /><section className="empty-state"><h1>We could not load this event.</h1><p>Refresh the page or try again shortly.</p><Link className="text-link" href={`/organizer/${organizationId}/events`}>Back to events</Link></section></main>;
  if (!typedEventRows.some((item) => item.id === eventId)) notFound();
  const event = typedEventRows.find((item) => item.id === eventId);
  if (!event) notFound();
  const canManage = ["owner", "admin", "editor"].includes(membership?.role ?? "");
  const categoryIds = (categories ?? []).map((category) => category.id);
  const { data: nominees, error: nomineeError } = categoryIds.length
    ? await supabase.from("nominees").select("id, category_id, name, public_code, biography, image_path, display_order, is_active").in("category_id", categoryIds).order("display_order", { ascending: true })
    : { data: [], error: null };
  const pagePath = `/organizer/${organizationId}/events/${eventId}`;
  const publicUrl = `/events/${event.slug}`;
  const imagePaths = nominees?.map((nominee) => nominee.image_path).filter((path): path is string => Boolean(path)) ?? [];
  const { data: signedImages } = imagePaths.length ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600) : { data: [] };
  const imageUrlByPath = new Map((signedImages ?? []).flatMap((image) => image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []));

  return <main className="dashboard-page"><DashboardHeader /><section className="dashboard-content">
    <div className="dashboard-utility"><Link className="back-link" href={`/organizer/${organizationId}/events`}>← {organization?.name ?? "Events"}</Link></div>
    <div className="event-detail-heading"><div><p className="eyebrow">EVENT SETUP</p><h1>{event.name}</h1><span className={`event-status event-status-${event.status}`}>{event.status.replaceAll("_", " ")}</span></div><div className="event-heading-actions">{event.status === "draft" && <Link className="secondary-button" href={`${pagePath}/preview`}>Preview voter page ↗</Link>}{event.status !== "draft" && event.status !== "archived" && <Link className="secondary-button" href={publicUrl}>View public page ↗</Link>}</div></div>
    {categoriesError || nomineeError ? <section className="form-message" role="alert">Some event details could not be loaded. Refresh the page to try again.</section> : <>
      {event.status === "draft" && <section className="event-editor-panel"><div className="panel-heading"><p className="eyebrow">STEP 1</p><h2>Event details and rules</h2><p>Choose free or paid voting, set the rules, then schedule the voting window.</p></div><EventDetailsForm eventId={eventId} organizationId={organizationId} initial={{ name: event.name, description: event.description, price: Number(event.unit_price_minor), startsAt: event.starts_at, endsAt: event.ends_at, resultsVisibility: event.results_visibility, votingMode: event.voting_mode, freeVoteLimit: event.free_vote_limit_per_phone, votingRules: event.voting_rules }} /></section>}
      <section className="event-editor-panel"><div className="panel-heading"><p className="eyebrow">STEP 2</p><h2>Categories and nominees</h2><p>Add the award categories, then add at least one nominee to each active category before publishing.</p></div>
        {categories?.length ? <div className="editor-category-list">{categories.map((category) => <article className={`editor-category ${category.is_active ? "" : "is-inactive"}`} key={category.id}><div className="category-heading"><div><h3>{category.name}</h3>{category.description && <p>{category.description}</p>}</div><span>{nominees?.filter((nominee) => nominee.category_id === category.id && nominee.is_active).length ?? 0} active nominees · {category.is_active ? "Visible" : "Hidden"}</span></div>
          {canManage && event.status === "draft" && <EditCategoryForm category={category} backTo={pagePath} />}
          <div className="editor-nominee-list">{nominees?.filter((nominee) => nominee.category_id === category.id).map((nominee) => <div className={`editor-nominee ${nominee.is_active ? "" : "is-inactive"}`} key={nominee.id}><span className="nominee-avatar" aria-hidden="true">{nominee.name.trim().slice(0, 1).toUpperCase()}</span><div className="editor-nominee-copy"><strong>{nominee.name}</strong>{nominee.public_code && <small>{nominee.public_code}</small>}{!nominee.is_active && <small>Hidden from voters</small>}</div>{canManage && event.status === "draft" && <><EditNomineeForm nominee={nominee} backTo={pagePath} /><NomineeImageForm eventId={eventId} nomineeId={nominee.id} nomineeName={nominee.name} initialPath={nominee.image_path} initialUrl={imageUrlByPath.get(nominee.image_path ?? "") ?? null} backTo={pagePath} /></>}</div>)}</div>
          {canManage && event.status === "draft" && <NomineeForm categoryId={category.id} backTo={pagePath} />}
        </article>)}</div> : <p className="quiet-empty">No categories have been added yet.</p>}
        {canManage && event.status === "draft" && <div className="add-category-panel"><h3>Add a category</h3><CategoryForm eventId={eventId} backTo={pagePath} /></div>}
      </section>
      <section className="event-publish-panel"><div><p className="eyebrow">STEP 3</p><h2>Review and publish</h2><p>Publishing makes the event and active nominees visible to the public. Voting and payments are added in a later phase.</p></div>
        {canManage && <div className="event-actions">{event.status === "draft" && <EventStatusForm eventId={eventId} action="publish" backTo={pagePath} label="Publish event" />} {event.status === "published" && <><EventStatusForm eventId={eventId} action="pause" backTo={pagePath} label="Pause event" /><EventStatusForm eventId={eventId} action="close" backTo={pagePath} label="Close event" confirmMessage="Close this event? This action cannot be undone." /></>}{event.status === "paused" && <><EventStatusForm eventId={eventId} action="resume" backTo={pagePath} label="Resume event" /><EventStatusForm eventId={eventId} action="close" backTo={pagePath} label="Close event" confirmMessage="Close this event? This action cannot be undone." /></>}{event.status === "closed" && <EventStatusForm eventId={eventId} action="archive" backTo={`/organizer/${organizationId}/events`} label="Archive event" confirmMessage="Archive this event from your workspace? This cannot be undone." />}</div>}
      </section>
    </>}
  </section></main>;
}
