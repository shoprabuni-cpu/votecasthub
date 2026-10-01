import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { InvitationPanel } from "@/components/organizations/invitation-panel";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Organization team" };
type Props = { params: Promise<{ organizationId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function OrganizationTeamPage({ params }: Props) {
  const { organizationId } = await params;
  if (!uuidPattern.test(organizationId)) notFound();
  const { supabase, userId } = await requireVerifiedUser();
  const [{ data: membership }, { data: organization }, { data: invitations, error }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_invitations", { p_organization_id: organizationId }),
    supabase.rpc("get_organization_team", { p_organization_id: organizationId }),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role)) notFound();
  const typedInvitations = (invitations ?? []) as Array<{ id: string; email: string; role: string; status: string; created_at: string; expires_at: string }>;
  const typedMembers = (members ?? []) as Array<{ user_id: string; email: string; display_name: string | null; role: string; joined_at: string }>;

  return <main className="dashboard-page"><DashboardHeader /><section className="dashboard-content">
    <div className="dashboard-utility"><Link className="back-link" href={`/organizer/${organizationId}/events`}>← {organization?.name ?? "Organization"}</Link></div>
    <p className="eyebrow">ORGANIZATION ACCESS</p><h1>Team invitations</h1><p className="auth-description">Invite trusted teammates with access that matches their role.</p>
    {error || membersError ? <section className="empty-state"><h2>We could not load team access.</h2><p>Refresh the page and try again.</p></section> : <InvitationPanel organizationId={organizationId} canInviteAdmin={membership.role === "owner"} invitations={typedInvitations} members={typedMembers} />}
  </section></main>;
}
