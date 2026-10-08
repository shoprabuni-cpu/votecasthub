import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { votingRuleSummary, type VotingRule } from "@/lib/voting-rules";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Private event preview", robots: { index: false, follow: false } };
type Props = { params: Promise<{ organizationId: string; eventId: string }> };

type OrganizationEvent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  currency: string;
  unit_price_minor: number;
  starts_at: string;
  ends_at: string;
  status: string;
  voting_mode: "free" | "paid";
  voting_rule: VotingRule;
  free_vote_limit_per_phone: number | null;
  voting_rules: string | null;
  image_path: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ghDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export default async function EventPreviewPage({ params }: Props) {
  const { organizationId, eventId } = await params;
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(eventId)) notFound();
  const { supabase } = await requireVerifiedUser();

  const [{ data: rows, error: eventError }, { data: organization }, { data: categories, error: categoryError }] =
    await Promise.all([
      supabase.rpc("get_organization_events", { p_organization_id: organizationId }),
      supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
      supabase
        .from("categories")
        .select("id, name, description, is_active, display_order")
        .eq("event_id", eventId)
        .order("display_order"),
    ]);

  if (eventError || categoryError) {
    return (
      <main className="min-h-screen bg-stone-50/60 pb-16">
        <DashboardHeader organizationId={organizationId} />
        <div className="mx-auto max-w-3xl px-4 pt-12 text-center">
          <div className="rounded-2xl border border-red-200 bg-white p-8">
            <h1 className="text-base font-semibold text-stone-900">Preview is temporarily unavailable.</h1>
            <p className="mt-1 text-xs text-stone-500">Refresh the page or return to event setup.</p>
            <Link
              className="mt-4 inline-block text-xs font-semibold text-emerald-800 hover:underline"
              href={`/organizer/${organizationId}/events/${eventId}`}
            >
              ← Back to event setup
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const event = ((rows ?? []) as OrganizationEvent[]).find((item) => item.id === eventId);
  if (!event) notFound();

  const categoryIds = (categories ?? []).map((item) => item.id);
  const { data: nominees, error: nomineeError } = categoryIds.length
    ? await supabase
        .from("nominees")
        .select("id, category_id, name, public_code, biography, image_path, is_active, display_order")
        .in("category_id", categoryIds)
        .order("display_order")
    : { data: [], error: null };

  if (nomineeError) {
    return (
      <main className="min-h-screen bg-stone-50/60 pb-16">
        <DashboardHeader organizationId={organizationId} />
        <div className="mx-auto max-w-3xl px-4 pt-12 text-center">
          <div className="rounded-2xl border border-red-200 bg-white p-8">
            <h1 className="text-base font-semibold text-stone-900">Preview is temporarily unavailable.</h1>
            <p className="mt-1 text-xs text-stone-500">Refresh the page or return to event setup.</p>
            <Link
              className="mt-4 inline-block text-xs font-semibold text-emerald-800 hover:underline"
              href={`/organizer/${organizationId}/events/${eventId}`}
            >
              ← Back to event setup
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const imagePaths =
    nominees?.map((nominee) => nominee.image_path).filter((path): path is string => Boolean(path)) ?? [];
  const { data: signedImages } = imagePaths.length
    ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600)
    : { data: [] };
  const imageUrlByPath = new Map(
    (signedImages ?? []).flatMap((image) =>
      image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []
    )
  );
  const { data: eventImage } = event.image_path
    ? await supabase.storage.from("nominee-images").createSignedUrl(event.image_path, 3600)
    : { data: null };

  const nomineesByCategory = new Map<string, NonNullable<typeof nominees>>();
  for (const nominee of nominees ?? []) {
    nomineesByCategory.set(nominee.category_id, [...(nomineesByCategory.get(nominee.category_id) ?? []), nominee]);
  }

  return (
    <main className="min-h-screen bg-stone-50/70 pb-24">
      <DashboardHeader organizationId={organizationId} />

      {/* Sticky Preview Banner */}
      <aside className="sticky top-0 z-30 flex items-center justify-between border-b border-amber-200/90 bg-amber-50/95 px-4 py-2.5 text-xs text-amber-900 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
            ✦
          </span>
          <span>
            <strong>Private Preview Mode</strong> · Only your organization team can see this draft.
          </span>
        </div>
        <Link
          href={`/organizer/${organizationId}/events/${eventId}`}
          className="inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline"
        >
          <span>Back to Setup Studio</span>
          <Icon name="arrowRight" size={13} />
        </Link>
      </aside>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 space-y-8">
        {/* Event Hero */}
        <section className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs">
          {eventImage?.signedUrl ? (
            <div
              className="h-56 sm:h-72 w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${eventImage.signedUrl}")` }}
              role="img"
              aria-label={`${event.name} cover image`}
            />
          ) : (
            <div className="h-32 bg-gradient-to-r from-emerald-950 via-emerald-900 to-stone-900" />
          )}

          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                {event.status === "draft" ? "Draft Ballot" : event.status.replaceAll("_", " ")}
              </span>
              <span className="text-xs text-stone-400 font-medium">· Hosted by {organization?.name ?? "Organizer"}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 tracking-tight">
              {event.name}
            </h1>

            <p className="text-sm text-stone-600 max-w-2xl leading-relaxed">
              {event.description || "No event description provided."}
            </p>

            {/* Event Facts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-stone-100">
              <div className="rounded-xl bg-stone-50 p-3">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Voting Opens</span>
                <p className="mt-0.5 text-xs font-semibold text-stone-900 font-mono">{ghDate(event.starts_at)}</p>
              </div>
              <div className="rounded-xl bg-stone-50 p-3">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Voting Closes</span>
                <p className="mt-0.5 text-xs font-semibold text-stone-900 font-mono">{ghDate(event.ends_at)}</p>
              </div>
              <div className="rounded-xl bg-stone-50 p-3">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Participation</span>
                <p className="mt-0.5 text-xs font-semibold text-stone-900">
                  {event.voting_mode === "free"
                    ? "Free voting"
                    : `GH₵ ${(event.unit_price_minor / 100).toFixed(2)} per vote`}
                </p>
              </div>
            </div>

            {/* Voting rules notice */}
            {event.voting_mode === "free" && (
              <div className="rounded-xl border border-emerald-950/10 bg-emerald-50/40 p-4 text-xs">
                <p className="font-semibold text-emerald-950">
                  Ballot Rule: {votingRuleSummary(event.voting_rule, event.free_vote_limit_per_phone)}
                </p>
                {event.voting_rules && (
                  <p className="mt-1 text-stone-600 leading-relaxed">
                    <strong>Organizer’s Note:</strong> {event.voting_rules}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Categories and Nominees Showcase */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
            <div>
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">The Ballot</span>
              <h2 className="text-xl font-serif font-bold text-stone-900">Categories & Nominees</h2>
            </div>
            <span className="text-xs font-medium text-stone-500">
              {categories?.filter((item) => item.is_active).length ?? 0} active categories
            </span>
          </div>

          {categories?.length ? (
            <div className="space-y-8">
              {categories.map((category) => {
                const categoryNominees = nomineesByCategory.get(category.id) ?? [];
                return (
                  <div
                    key={category.id}
                    className={`rounded-2xl border p-5 sm:p-7 bg-white shadow-xs ${
                      category.is_active ? "border-stone-200" : "border-stone-200/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                      <div>
                        <h3 className="text-lg font-serif font-bold text-stone-900">{category.name}</h3>
                        {category.description && (
                          <p className="text-xs text-stone-500 mt-0.5">{category.description}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-semibold text-stone-600">
                        {categoryNominees.length} {categoryNominees.length === 1 ? "Nominee" : "Nominees"}
                      </span>
                    </div>

                    {categoryNominees.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {categoryNominees.map((nominee) => {
                          const imageUrl = imageUrlByPath.get(nominee.image_path ?? "");
                          return (
                            <div
                              key={nominee.id}
                              className={`rounded-xl border p-3.5 bg-stone-50/50 flex flex-col justify-between ${
                                nominee.is_active ? "border-stone-200" : "border-stone-200/60 opacity-60"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={nominee.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center font-serif font-bold text-emerald-900 bg-emerald-50">
                                      {nominee.name.trim().slice(0, 1).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-semibold text-stone-900 text-xs truncate">{nominee.name}</h4>
                                  {nominee.public_code && (
                                    <span className="mt-0.5 inline-block rounded-md bg-stone-200/80 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-stone-700">
                                      {nominee.public_code}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {nominee.biography && (
                                <p className="mt-2 text-[11px] text-stone-500 line-clamp-2">{nominee.biography}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 italic">No nominees added to this category yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">
              No categories have been added to this event yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
