import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Organization events" };
type Props = { params: Promise<{ organizationId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type OrganizationEvent = { id: string; name: string; starts_at: string; ends_at: string; status: string };

export default async function OrganizationEventsPage({ params }: Props) {
  const { organizationId } = await params;
  if (!uuidPattern.test(organizationId)) notFound();
  const { supabase, userId } = await requireVerifiedUser();
  const { data: organization, error: orgError } = await supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle();
  if (!orgError && !organization) notFound();
  const [{ data: membership, error: membershipError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
    supabase.rpc("get_organization_events", { p_organization_id: organizationId }),
  ]);
  if (!membership && !membershipError) notFound();
  const canCreateEvent = ["owner", "admin", "editor"].includes(membership?.role ?? "");
  const eventRows = (events ?? []) as OrganizationEvent[];
  const publishedCount = eventRows.filter((event) => event.status === "published").length;
  const draftCount = eventRows.filter((event) => event.status === "draft").length;

  return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="dashboard-content">
    <div className="dashboard-utility"><Link className="back-link" href="/organizer">← Organizations</Link></div>
    <p className="eyebrow">ORGANIZATION WORKSPACE</p><div className="section-title-row"><div><h1>{organization?.name ?? "Your organization"}</h1><p className="auth-description">Manage event details, categories, nominees, and publication.</p></div>
      <div className="organization-actions">{["owner", "admin"].includes(membership?.role ?? "") && <Link className="secondary-button" href={`/organizer/${organizationId}/team`}>Team access</Link>}{canCreateEvent && <Link className="primary-link" href={`/organizer/${organizationId}/events/new`}>Create event <span aria-hidden="true">＋</span></Link>}</div></div>
    {!membershipError && !eventsError && !orgError && <section className="workspace-overview" aria-label="Organization event summary"><article><span>Total events</span><strong>{eventRows.length}</strong><small>In this workspace</small></article><article><span>Published</span><strong>{publishedCount}</strong><small>Visible to voters</small></article><article><span>Drafts</span><strong>{draftCount}</strong><small>Still being prepared</small></article></section>}
    <div className="workspace-section-heading"><div><p className="eyebrow">EVENT MANAGEMENT</p><h2>Your events</h2><p>Open an event to update its details, nominees, or rules.</p></div></div>
    {membershipError || eventsError || orgError ? <section className="empty-state"><h2>We could not load this workspace.</h2><p>Refresh the page or try again shortly.</p><Link className="text-link" href={`/organizer/${organizationId}/events`}>Try again</Link></section> : eventRows.length ? <div className="organizer-event-list">{eventRows.map((event) => <Link className="organizer-event-card" href={`/organizer/${organizationId}/events/${event.id}`} key={event.id}>
      <div><span className={`event-status event-status-${event.status}`}>{event.status.replaceAll("_", " ")}</span><h2>{event.name}</h2><p>{new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" }).format(new Date(event.starts_at))} – {new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" }).format(new Date(event.ends_at))}</p></div><span className="organizer-event-arrow" aria-hidden="true">↗</span>
    </Link>)}</div> : <section className="empty-state"><span className="empty-icon">✦</span><h2>No events yet.</h2><p>Create a draft and add categories and nominees before publishing.</p><Link className="primary-link" href={`/organizer/${organizationId}/events/new`}>Create your first event</Link></section>}
  </section></main>;
}
