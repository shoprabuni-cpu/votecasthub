import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { InvitationPanel } from "@/components/organizations/invitation-panel";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Team & Invitations · VoteHub" };
type Props = { params: Promise<{ organizationId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function OrganizationTeamPage({ params }: Props) {
  const { organizationId } = await params;
  if (!uuidPattern.test(organizationId)) notFound();
  const { supabase, userId } = await requireVerifiedUser();

  const [
    { data: membership },
    { data: organization },
    { data: invitations, error },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_invitations", { p_organization_id: organizationId }),
    supabase.rpc("get_organization_team", { p_organization_id: organizationId }),
  ]);

  if (!membership || !["owner", "admin"].includes(membership.role)) notFound();

  const typedInvitations = (invitations ?? []) as Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
    expires_at: string;
  }>;

  const typedMembers = (members ?? []) as Array<{
    user_id: string;
    email: string;
    display_name: string | null;
    role: string;
    joined_at: string;
  }>;

  return (
    <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900 pb-20">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href={`/organizer/${organizationId}/events`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
          >
            <Icon name="arrowLeft" size={14} />
            <span>{organization?.name ?? "Back to workspace"}</span>
          </Link>
        </div>

        {/* Hero Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                ORGANIZATION ACCESS
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl">
              Team Members & Invitations
            </h1>
            <p className="mt-1 text-xs text-stone-500 max-w-xl">
              Invite trusted colleagues to collaborate on event setup, nominee vetting, and ballot
              monitoring.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 font-semibold text-stone-700">
              <Icon name="users" size={13} />
              <span>{typedMembers.length} active</span>
            </span>
            {typedInvitations.filter((i) => i.status === "pending").length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800 border border-amber-200/60">
                <span>
                  {typedInvitations.filter((i) => i.status === "pending").length} pending
                </span>
              </span>
            )}
          </div>
        </div>

        {error || membersError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center text-xs text-red-900 shadow-2xs">
            <h2 className="text-sm font-semibold text-red-950">We could not load team access.</h2>
            <p className="mt-1 text-red-800">Please refresh the page and try again.</p>
          </div>
        ) : (
          <InvitationPanel
            organizationId={organizationId}
            canInviteAdmin={membership.role === "owner"}
            invitations={typedInvitations}
            members={typedMembers}
          />
        )}
      </section>
    </main>
  );
}
