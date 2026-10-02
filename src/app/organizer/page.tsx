import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { CreateOrganizationForm } from "@/components/auth/create-organization-form";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Organizer dashboard" };

export default async function OrganizerPage() {
  const { supabase, userId } = await requireVerifiedUser();
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (membershipError) {
    return <main className="dashboard-page"><DashboardHeader/><section className="dashboard-content"><div className="dashboard-error-card"><span className="dashboard-error-icon">!</span><p className="eyebrow">ORGANIZER WORKSPACE</p><h1>Organizations aren’t loading right now.</h1><p className="auth-description">Your session is still active. Refresh the page or try again shortly.</p><Link className="primary-link" href="/organizer">Try again <span aria-hidden="true">↻</span></Link></div></section></main>;
  }

  const organizationIds = [...new Set((memberships ?? []).map((item) => item.organization_id))];
  const { data: organizations, error: organizationError } = organizationIds.length
    ? await supabase.from("organizations").select("id, name, slug, created_at").in("id", organizationIds).is("archived_at", null).order("created_at", { ascending: false })
    : { data: [], error: null };

  if (organizationError) {
    return <main className="dashboard-page"><DashboardHeader/><section className="dashboard-content"><div className="dashboard-error-card"><span className="dashboard-error-icon">!</span><p className="eyebrow">ORGANIZER WORKSPACE</p><h1>Organizations aren’t loading right now.</h1><p className="auth-description">Your session is still active. Refresh the page or try again shortly.</p><Link className="primary-link" href="/organizer">Try again <span aria-hidden="true">↻</span></Link></div></section></main>;
  }

  const roleByOrganization = new Map((memberships ?? []).map((item) => [item.organization_id, item.role]));
  return <main className="dashboard-page organizer-home">
    <DashboardHeader/>
    <section className="dashboard-content organizer-home-content">
      <div className="organizer-welcome"><div><p className="eyebrow"><span className="status-dot"/> ORGANIZER STUDIO</p><h1>Your organizations,<br/><em>all in one place.</em></h1><p className="auth-description">Create award events, manage nominees, and bring your team together in a dedicated workspace.</p></div><div className="welcome-orbit" aria-hidden="true"><span className="welcome-orbit-ring"/><span className="welcome-orbit-core">V</span><span className="welcome-orbit-spark">✦</span></div></div>
      <div className="organizer-overview-strip"><div><span className="overview-symbol">◫</span><span><strong>{organizations?.length ?? 0}</strong><small>Organizations</small></span></div><span className="overview-strip-note">Choose a workspace to continue <span aria-hidden="true">→</span></span></div>
      <div className="organizer-home-grid">
        <section className="organization-panel"><div className="dashboard-section-heading"><div><p className="eyebrow">WORKSPACES</p><h2>Your organizations</h2></div><span className="dashboard-count">{organizations?.length ?? 0} total</span></div>
          {organizations && organizations.length > 0 ? <div className="organization-list">{organizations.map((organization, index) => <Link className="organization-card organization-card-link" href={`/organizer/${organization.id}/events`} key={organization.id} style={{ animationDelay: `${index * 60}ms` }}>
            <span className="organization-card-emblem">{organization.name.trim().slice(0, 1).toUpperCase()}</span><span className="organization-card-copy"><strong>{organization.name}</strong><small>{organization.slug}</small></span><span className="role-badge">{roleByOrganization.get(organization.id) ?? "member"}</span><span className="organizer-event-arrow" aria-hidden="true">↗</span>
          </Link>)}</div> : <div className="organization-empty"><span className="organization-empty-icon">＋</span><h3>Your first workspace is one step away</h3><p>Create an organization to start setting up events and inviting your team.</p></div>}
        </section>
        <section className="onboarding-panel"><span className="create-org-icon">＋</span><p className="eyebrow">GET STARTED</p><h2>Create an organization</h2><p>Set up a workspace for your awards, competitions, or community event.</p><CreateOrganizationForm/><div className="create-org-note"><span>✦</span> Your organization can add events and team members as you grow.</div></section>
      </div>
    </section>
  </main>;
}
