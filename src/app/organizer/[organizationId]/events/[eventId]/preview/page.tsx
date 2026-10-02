import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Private event preview", robots: { index: false, follow: false } };
type Props = { params: Promise<{ organizationId: string; eventId: string }> };
type OrganizationEvent = { id: string; name: string; slug: string; description: string | null; currency: string; unit_price_minor: number; starts_at: string; ends_at: string; status: string; voting_mode: "free" | "paid"; free_vote_limit_per_phone: number | null; voting_rules: string | null; image_path: string | null };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ghDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(value));
}

export default async function EventPreviewPage({ params }: Props) {
  const { organizationId, eventId } = await params;
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(eventId)) notFound();
  const { supabase } = await requireVerifiedUser();
  const [{ data: rows, error: eventError }, { data: organization }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.rpc("get_organization_events", { p_organization_id: organizationId }),
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.from("categories").select("id, name, description, is_active, display_order").eq("event_id", eventId).order("display_order"),
  ]);
  if (eventError || categoryError) return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="empty-state"><h1>Preview is temporarily unavailable.</h1><p>Refresh the page or return to event setup.</p><Link className="text-link" href={`/organizer/${organizationId}/events/${eventId}`}>Back to event setup</Link></section></main>;
  const event = ((rows ?? []) as OrganizationEvent[]).find((item) => item.id === eventId);
  if (!event) notFound();
  const categoryIds = (categories ?? []).map((item) => item.id);
  const { data: nominees, error: nomineeError } = categoryIds.length
    ? await supabase.from("nominees").select("id, category_id, name, public_code, biography, image_path, is_active, display_order").in("category_id", categoryIds).order("display_order")
    : { data: [], error: null };
  if (nomineeError) return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="empty-state"><h1>Preview is temporarily unavailable.</h1><p>Refresh the page or return to event setup.</p><Link className="text-link" href={`/organizer/${organizationId}/events/${eventId}`}>Back to event setup</Link></section></main>;
  const imagePaths = nominees?.map((nominee) => nominee.image_path).filter((path): path is string => Boolean(path)) ?? [];
  const { data: signedImages } = imagePaths.length ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600) : { data: [] };
  const imageUrlByPath = new Map((signedImages ?? []).flatMap((image) => image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []));
  const { data: eventImage } = event.image_path ? await supabase.storage.from("nominee-images").createSignedUrl(event.image_path, 3600) : { data: null };
  const nomineesByCategory = new Map<string, NonNullable<typeof nominees>>();
  for (const nominee of nominees ?? []) nomineesByCategory.set(nominee.category_id, [...(nomineesByCategory.get(nominee.category_id) ?? []), nominee]);

  return <main className="public-page"><DashboardHeader organizationId={organizationId} />
    <aside className="private-preview-banner"><span><strong>Private preview</strong> · Only organization members can see this draft.</span><Link className="text-link" href={`/organizer/${organizationId}/events/${eventId}`}>Back to setup →</Link></aside>
    <section className="event-hero">{eventImage?.signedUrl && <div className="event-hero-cover" style={{ backgroundImage: `url("${eventImage.signedUrl}")` }} role="img" aria-label={`${event.name} cover image`} />}<Link className="back-link" href={`/organizer/${organizationId}/events/${eventId}`}>← {organization?.name ?? "Event setup"}</Link><p className="eyebrow">VOTER PAGE PREVIEW</p><span className="public-status">{event.status === "draft" ? "Draft preview" : event.status.replaceAll("_", " ")}</span><h1>{event.name}</h1><p className="event-hero-description">{event.description || "Your event description will appear here."}</p><div className="event-facts"><span><small>VOTING OPENS</small>{ghDate(event.starts_at)}</span><span><small>VOTING CLOSES</small>{ghDate(event.ends_at)}</span><span><small>VOTING TYPE</small>{event.voting_mode === "free" ? `Free · up to ${event.free_vote_limit_per_phone} per phone/category` : `GHS ${(event.unit_price_minor / 100).toFixed(2)} per vote`}</span></div>{event.voting_rules && <section className="public-rules"><p className="eyebrow">HOW VOTING WORKS</p><p>{event.voting_rules}</p></section>}</section>
    <section className="public-categories"><div className="section-title-row"><div><p className="eyebrow">THE NOMINEES</p><h2>Categories and nominees</h2></div><span>{categories?.filter((item) => item.is_active).length ?? 0} active categories</span></div>
      {categories?.length ? categories.map((category) => <section className={`public-category${category.is_active ? "" : " preview-inactive"}`} key={category.id}><div className="category-heading"><div><h3>{category.name}</h3>{category.description && <p>{category.description}</p>}</div><span>{category.is_active ? "Visible to voters" : "Hidden"}</span></div><div className="nominee-grid">{(nomineesByCategory.get(category.id) ?? []).map((nominee) => <article className={`public-nominee-card${nominee.is_active ? "" : " preview-inactive"}`} key={nominee.id}>{imageUrlByPath.get(nominee.image_path ?? "") ? <div className="nominee-photo-card" style={{ backgroundImage: `url("${imageUrlByPath.get(nominee.image_path ?? "")}")` }} role="img" aria-label={`${nominee.name} photo`} /> : <span className="nominee-avatar" aria-hidden="true">{nominee.name.trim().slice(0, 1).toUpperCase()}</span>}<span className="nominee-card-copy"><strong>{nominee.name}</strong>{nominee.public_code && <small>{nominee.public_code}</small>}{nominee.biography && <small>{nominee.biography}</small>}</span></article>)}</div>{!nomineesByCategory.get(category.id)?.length && <p className="quiet-empty">No nominees added yet.</p>}</section>) : <div className="empty-state compact-empty"><h3>No categories yet.</h3><p>Add categories and nominees to preview the voter page.</p></div>}
    </section>
  </main>;
}
