import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventDetailsForm } from "@/components/events/event-details-form";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Create an event" };
type Props = { params: Promise<{ organizationId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NewEventPage({ params }: Props) {
  const { organizationId } = await params;
  if (!uuidPattern.test(organizationId)) notFound();
  const { supabase } = await requireVerifiedUser();
  const [{ data: organization, error }, { data: smsBalance }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_sms_balance", { p_org: organizationId }),
  ]);
  if (!organization && !error) notFound();

  return (
    <main className="min-h-screen bg-stone-50/60 pb-16">
      <DashboardHeader organizationId={organizationId} />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/organizer/${organizationId}/events`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-emerald-900 transition-colors"
          >
            <Icon name="arrowLeft" size={13} />
            <span>Back to {organization?.name ?? "Events"}</span>
          </Link>
        </div>

        {/* Page Title & Intro */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1 text-[11px] font-semibold text-emerald-900 tracking-wide uppercase">
            <Icon name="sparkle" size={12} />
            <span>New Event Studio</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-medium text-stone-900 tracking-tight">
            Create your voting event
          </h1>
          <p className="mt-1 text-sm text-stone-600 max-w-2xl">
            Set up the ballot identity and voting parameters. Once the draft is saved, you can add award categories, nominees, and custom cover banners.
          </p>
        </div>

        {/* Form Container or Error */}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
            <h2 className="text-base font-semibold text-stone-900">We could not load this organization.</h2>
            <p className="mt-1 text-xs text-stone-500">Please refresh or try again shortly.</p>
          </div>
        ) : (
          <EventDetailsForm
            organizationId={organizationId}
            smsBalance={typeof smsBalance === "number" ? smsBalance : null}
          />
        )}
      </div>
    </main>
  );
}
