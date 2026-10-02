import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventDetailsForm } from "@/components/events/event-details-form";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Create an event" };
type Props = { params: Promise<{ organizationId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NewEventPage({ params }: Props) {
  const { organizationId } = await params;
  if (!uuidPattern.test(organizationId)) notFound();
  const { supabase } = await requireVerifiedUser();
  const { data: organization, error } = await supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle();
  if (!organization && !error) notFound();
  return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="dashboard-content">
    <Link className="back-link" href={`/organizer/${organizationId}/events`}>← {organization?.name ?? "Events"}</Link>
    <p className="eyebrow">NEW EVENT · DRAFT</p><h1>Set up your event.</h1><p className="auth-description">Start with the basics. You can add categories and nominees after saving the draft.</p>
    {error ? <section className="empty-state"><h2>We could not load this organization.</h2><p>Please try again shortly.</p></section> : <section className="event-editor-panel"><EventDetailsForm organizationId={organizationId} /></section>}
  </section></main>;
}
