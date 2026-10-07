import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { CreateOrganizationForm } from "@/components/auth/create-organization-form";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Organizer dashboard — VotecastHub" };

export default async function OrganizerPage() {
  const { supabase, userId } = await requireVerifiedUser();
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (membershipError) {
    return (
      <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
        <DashboardHeader />
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="alert" size={24} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-700">ORGANIZER WORKSPACE</p>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Organizations aren’t loading right now
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
              Your session is still active. Refresh the page or try again shortly.
            </p>
            <div className="mt-6">
              <Link
                href="/organizer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-800 active:scale-95"
              >
                Try again ↻
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const organizationIds = [...new Set((memberships ?? []).map((item) => item.organization_id))];
  const { data: organizations, error: organizationError } = organizationIds.length
    ? await supabase
        .from("organizations")
        .select("id, name, slug, created_at")
        .in("id", organizationIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (organizationError) {
    return (
      <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
        <DashboardHeader />
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="alert" size={24} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-700">ORGANIZER WORKSPACE</p>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Organizations aren’t loading right now
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
              Your session is still active. Refresh the page or try again shortly.
            </p>
            <div className="mt-6">
              <Link
                href="/organizer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-800 active:scale-95"
              >
                Try again ↻
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Smooth frictionless auto-redirect if the organizer has exactly 1 organization
  if (organizations && organizations.length === 1) {
    redirect(`/organizer/${organizations[0].id}/events`);
  }

  const roleByOrganization = new Map((memberships ?? []).map((item) => [item.organization_id, item.role]));

  return (
    <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
      <DashboardHeader />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-[#133c2e] to-emerald-950 p-8 text-white shadow-sm sm:p-10">
          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ORGANIZER STUDIO
              </div>
              <h1 className="mt-4 text-3xl font-serif font-bold tracking-tight text-white sm:text-4xl">
                Your organizations, <span className="text-emerald-300 italic">all in one place.</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-emerald-100/80 sm:text-base">
                Create award events, configure voting categories, manage nominees, and coordinate team members in dedicated workspaces.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-emerald-300 border border-white/20">
                <Icon name="users" size={20} />
              </div>
              <div>
                <div className="text-xl font-bold text-white font-mono">{organizations?.length ?? 0}</div>
                <div className="text-xs text-emerald-200/80 uppercase tracking-wider font-medium">Workspaces</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Organizations list */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">WORKSPACES</p>
                <h2 className="text-xl font-bold text-stone-900">Your organizations</h2>
              </div>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-2xs">
                {organizations?.length ?? 0} total
              </span>
            </div>

            {organizations && organizations.length > 0 ? (
              <div className="grid gap-3.5">
                {organizations.map((organization) => {
                  const role = roleByOrganization.get(organization.id) ?? "member";
                  return (
                    <Link
                      key={organization.id}
                      href={`/organizer/${organization.id}/events`}
                      className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition-all duration-200 hover:border-emerald-600/40 hover:shadow-md hover:bg-emerald-50/20 active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-lg font-bold text-white shadow-xs transition-transform group-hover:scale-105">
                          {organization.name.trim().slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-stone-900 group-hover:text-emerald-800 transition-colors">
                            {organization.name}
                          </div>
                          <div className="text-xs text-stone-500 font-mono tracking-wide mt-0.5">
                            {organization.slug}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium capitalize text-stone-600 group-hover:border-emerald-200 group-hover:text-emerald-700 transition-colors">
                          {role}
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-400 transition-all group-hover:bg-emerald-700 group-hover:text-white group-hover:translate-x-0.5">
                          <Icon name="arrowRight" size={14} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-xs">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                  <Icon name="users" size={22} />
                </div>
                <h3 className="text-base font-semibold text-stone-900">Your first workspace is one step away</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
                  Create an organization to start setting up award ceremonies, inviting nominees, and managing votes.
                </p>
              </div>
            )}
          </div>

          {/* Create organization side panel */}
          <div className="lg:col-span-5">
            <div className="sticky top-8 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Icon name="sparkle" size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">GET STARTED</p>
                  <h2 className="text-lg font-bold text-stone-900">Create an organization</h2>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-stone-600">
                Set up a workspace for your awards show, university election, pageantry, or community voting event.
              </p>

              <div className="mt-6 pt-6 border-t border-stone-100">
                <CreateOrganizationForm />
              </div>

              <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-xs text-stone-600">
                <span className="text-emerald-700 mt-0.5">✦</span>
                <span>You can create multiple events and invite co-organizers, editors, and accountants once your workspace is ready.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
