import type { Metadata } from "next";
import Link from "next/link";
import { CreateOrganizationForm } from "@/components/auth/create-organization-form";
import { SignOutForm } from "@/components/auth/sign-out-form";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Organizer dashboard" };

export default async function OrganizerPage() {
  const { supabase, userId } = await requireVerifiedUser();
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (membershipError) {
    return <main className="dashboard-page"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><SignOutForm /></header><section className="dashboard-content"><p className="eyebrow">ORGANIZER DASHBOARD</p><h1>We could not load your organizations.</h1><p className="auth-description">Your session is still active. Refresh the page or try again shortly.</p><Link className="primary-link" href="/organizer">Try again</Link></section></main>;
  }

  const organizationIds = [...new Set((memberships ?? []).map((item) => item.organization_id))];
  const { data: organizations, error: organizationError } = organizationIds.length
    ? await supabase.from("organizations").select("id, name, slug, created_at").in("id", organizationIds).is("archived_at", null).order("created_at", { ascending: false })
    : { data: [], error: null };

  if (organizationError) {
    return <main className="dashboard-page"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><SignOutForm /></header><section className="dashboard-content"><p className="eyebrow">ORGANIZER DASHBOARD</p><h1>We could not load your organizations.</h1><p className="auth-description">Your session is still active. Refresh the page or try again shortly.</p><Link className="primary-link" href="/organizer">Try again</Link></section></main>;
  }

  const roleByOrganization = new Map((memberships ?? []).map((item) => [item.organization_id, item.role]));
  return <main className="dashboard-page">
    <header className="dashboard-header"><Link className="brand" href="/" aria-label="VotecastHub GH home"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><SignOutForm /></header>
    <section className="dashboard-content">
      <p className="eyebrow">ORGANIZER DASHBOARD</p>
      <h1>Your organizations</h1>
      <p className="auth-description">Set up an organization to start managing awards and competitions.</p>
      {organizations && organizations.length > 0 && <div className="organization-list">{organizations.map((organization) => <Link className="organization-card organization-card-link" href={`/organizer/${organization.id}/events`} key={organization.id}>
        <div><h2>{organization.name}</h2><p>{organization.slug}</p></div><span className="organization-card-end"><span className="role-badge">{roleByOrganization.get(organization.id) ?? "member"}</span><span className="organizer-event-arrow" aria-hidden="true">↗</span></span>
      </Link>)}</div>}
      <section className="onboarding-panel"><h2>{organizations?.length ? "Add another organization" : "Create your first organization"}</h2><p>Organization owners can invite teammates in a later setup step.</p><CreateOrganizationForm /></section>
    </section>
  </main>;
}
