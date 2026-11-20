import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCachedSignedUrls, getCachedSignedUrl } from "@/lib/storage/signed-url-cache";
import { generateAuditHash } from "@/lib/exports/audit-reports";

export interface RankedContender {
  id: string;
  name: string;
  public_code: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
  vote_count: number;
  vote_share_percentage: number;
  rank: number;
  is_winner: boolean;
}

export interface CategoryResults {
  category_id: string;
  category_name: string;
  category_description: string | null;
  total_votes: number;
  contenders: RankedContender[];
  winner: RankedContender | null;
  podium: RankedContender[];
}

export interface EventResultsSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  organization_name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  results_visibility: string;
  results_released: boolean;
  is_ended: boolean;
  total_votes: number;
  category_count: number;
  nominee_count: number;
  top_leader?: {
    name: string;
    category_name: string;
    votes: number;
  } | null;
}

export interface EventFullResults {
  is_public: boolean;
  lock_reason?: string;
  event: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    organization_name: string;
    status: string;
    starts_at: string;
    ends_at: string;
    results_visibility: string;
    results_released: boolean;
    unit_price_minor: number;
    voting_mode: string;
    is_live: boolean;
    is_ended: boolean;
  };
  audit_hash: string;
  total_ballots: number;
  total_categories: number;
  total_nominees: number;
  categories: CategoryResults[];
}

/**
 * Checks whether an event's vote tallies are legally allowed to be viewed publicly
 * based on the organizer's results_visibility setting and contest timing.
 */
export function isEventResultsPublic(event: {
  results_visibility: string;
  status: string;
  starts_at: string;
  ends_at: string;
  results_released?: boolean | null;
}): boolean {
  const now = new Date().getTime();
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();

  if (event.results_visibility === "live") {
    return (
      ["published", "paused", "closed"].includes(event.status) &&
      now >= startsAt
    );
  }

  if (event.results_visibility === "after_close") {
    return (
      Boolean(event.results_released) ||
      ["closed", "archived"].includes(event.status) ||
      now >= endsAt
    );
  }

  // organizer_only and hidden are strictly non-public
  return false;
}

/**
 * Load directory of all events eligible for public awards results display.
 */
export async function loadPublicAwardsDirectory(customClient?: any): Promise<EventResultsSummary[]> {
  const supabase = customClient || (await createClient());

  const { data: rawEvents, error } = await supabase
    .from("events")
    .select(
      "id, name, slug, description, image_path, starts_at, ends_at, status, results_visibility, results_released, unit_price_minor, voting_mode"
    )
    .in("status", ["published", "paused", "closed"])
    .in("results_visibility", ["live", "after_close"])
    .order("ends_at", { ascending: false });

  if (error || !rawEvents) {
    return [];
  }

  const now = Date.now();
  const eligibleEvents = rawEvents.filter((e: any) => {
    return isEventResultsPublic(e);
  });

  if (!eligibleEvents.length) {
    return [];
  }

  // Resolve signed banner images using memory cache
  const imagePaths = eligibleEvents
    .map((e: any) => e.image_path)
    .filter((p: string | null): p is string => Boolean(p));

  const signedUrlMap = imagePaths.length > 0
    ? await getCachedSignedUrls(supabase, "nominee-images", imagePaths, 3600)
    : new Map<string, string>();

  // For each eligible event, fetch tallies to show preview stats
  const resultsList: EventResultsSummary[] = [];

  for (const ev of eligibleEvents) {
    const endsTime = new Date(ev.ends_at).getTime();
    const isEnded = ev.status === "closed" || now >= endsTime;

    // Fetch public results for preview
    const { data: voteRows } = await supabase.rpc("get_public_event_results", {
      p_event_id: ev.id,
    });

    const rows = (voteRows ?? []) as Array<{ nominee_id: string; vote_count: string | number }>;
    const totalVotes = rows.reduce((acc, r) => acc + Number(r.vote_count || 0), 0);

    // Fetch categories count
    const { count: catCount } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .eq("is_active", true);

    resultsList.push({
      id: ev.id,
      name: ev.name,
      slug: ev.slug,
      description: ev.description,
      image_url: ev.image_path ? signedUrlMap.get(ev.image_path) ?? null : null,
      organization_name: ev.organizations?.name || "Official Organization",
      status: ev.status,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      results_visibility: ev.results_visibility,
      results_released: Boolean(ev.results_released),
      is_ended: isEnded,
      total_votes: totalVotes,
      category_count: catCount ?? 0,
      nominee_count: rows.length,
    });
  }

  return resultsList;
}

/**
 * Load complete awards breakdown, category podiums, and certified tallies for a single event.
 */
export async function loadEventPublicResults(
  slugOrId: string,
  customClient?: any
): Promise<EventFullResults | null> {
  const supabase = customClient || (await createClient());

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

  let query = supabase
    .from("events")
    .select(
      "id, name, slug, description, image_path, starts_at, ends_at, status, results_visibility, results_released, unit_price_minor, voting_mode"
    )
    .in("status", ["published", "paused", "closed"]);

  if (isUUID) {
    query = query.eq("id", slugOrId);
  } else {
    query = query.eq("slug", slugOrId);
  }

  const { data: eventData, error: eventErr } = await query.maybeSingle();

  if (eventErr || !eventData) {
    return null;
  }

  const now = Date.now();
  const startsTime = new Date(eventData.starts_at).getTime();
  const endsTime = new Date(eventData.ends_at).getTime();
  const isLive = eventData.status === "published" && now >= startsTime && now < endsTime;
  const isEnded = eventData.status === "closed" || now >= endsTime;

  // Sign banner image using memory cache
  const bannerUrl = eventData.image_path
    ? await getCachedSignedUrl(supabase, "nominee-images", eventData.image_path, 3600)
    : null;

  const eventSummary = {
    id: eventData.id,
    name: eventData.name,
    slug: eventData.slug,
    description: eventData.description,
    image_url: bannerUrl,
    organization_name: "Verified Organizer",
    status: eventData.status,
    starts_at: eventData.starts_at,
    ends_at: eventData.ends_at,
    results_visibility: eventData.results_visibility,
    results_released: Boolean(eventData.results_released),
    unit_price_minor: Number(eventData.unit_price_minor || 0),
    voting_mode: eventData.voting_mode,
    is_live: isLive,
    is_ended: isEnded,
  };

  const isPublic = isEventResultsPublic(eventData);

  if (!isPublic) {
    let reason = "Results for this event are private or organizer-only.";
    if (eventData.results_visibility === "after_close" && !isEnded) {
      reason = "Live results are hidden during active voting. Final results will be automatically published when voting closes.";
    }

    return {
      is_public: false,
      lock_reason: reason,
      event: eventSummary,
      audit_hash: generateAuditHash(eventData.id),
      total_ballots: 0,
      total_categories: 0,
      total_nominees: 0,
      categories: [],
    };
  }

  // 1. Fetch tallies from RPC
  const { data: rawTallies } = await supabase.rpc("get_public_event_results", {
    p_event_id: eventData.id,
  });

  const tallyMap = new Map<string, number>();
  for (const r of (rawTallies ?? []) as Array<{ nominee_id: string; vote_count: string | number }>) {
    tallyMap.set(r.nominee_id, Number(r.vote_count || 0));
  }

  // 2. Fetch categories
  const { data: rawCategories } = await supabase
    .from("categories")
    .select("id, name, description, display_order")
    .eq("event_id", eventData.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const categories: Array<{ id: string; name: string; description: string | null; display_order: number }> = (rawCategories as any) ?? [];
  const catIds = categories.map((c) => c.id);

  // 3. Fetch nominees
  let nominees: Array<{
    id: string;
    category_id: string;
    name: string;
    public_code: string | null;
    image_path: string | null;
    display_order: number;
  }> = [];

  if (catIds.length > 0) {
    const { data: rawNominees } = await supabase
      .from("nominees")
      .select("id, category_id, name, public_code, image_path, display_order")
      .in("category_id", catIds)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    nominees = rawNominees ?? [];
  }

  // Sign nominee photos
  const nomineeImagePaths = nominees
    .map((n) => n.image_path)
    .filter((p): p is string => Boolean(p));

  const nomineeImageUrlMap = nomineeImagePaths.length > 0
    ? await getCachedSignedUrls(supabase, "nominee-images", nomineeImagePaths, 3600)
    : new Map<string, string>();

  // Group and rank contenders per category
  let totalEventVotes = 0;
  const categoryResults: CategoryResults[] = [];

  for (const cat of categories) {
    const catNominees = nominees.filter((n) => n.category_id === cat.id);
    const catTotalVotes = catNominees.reduce(
      (sum, n) => sum + (tallyMap.get(n.id) ?? 0),
      0
    );
    totalEventVotes += catTotalVotes;

    // Sort nominees by votes descending; tie-breaker by display_order
    const sorted = [...catNominees].sort((a, b) => {
      const vA = tallyMap.get(a.id) ?? 0;
      const vB = tallyMap.get(b.id) ?? 0;
      if (vB !== vA) return vB - vA;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });

    const rankedContenders: RankedContender[] = sorted.map((nominee, idx) => {
      const votes = tallyMap.get(nominee.id) ?? 0;
      const share = catTotalVotes > 0 ? (votes / catTotalVotes) * 100 : 0;
      return {
        id: nominee.id,
        name: nominee.name,
        public_code: nominee.public_code,
        image_url: nominee.image_path ? nomineeImageUrlMap.get(nominee.image_path) ?? null : null,
        category_id: cat.id,
        category_name: cat.name,
        vote_count: votes,
        vote_share_percentage: parseFloat(share.toFixed(1)),
        rank: idx + 1,
        is_winner: idx === 0 && votes > 0,
      };
    });

    const winner = rankedContenders.length > 0 && rankedContenders[0].vote_count > 0 ? rankedContenders[0] : null;
    const podium = rankedContenders.slice(0, 3);

    categoryResults.push({
      category_id: cat.id,
      category_name: cat.name,
      category_description: cat.description,
      total_votes: catTotalVotes,
      contenders: rankedContenders,
      winner,
      podium,
    });
  }

  return {
    is_public: true,
    event: eventSummary,
    audit_hash: generateAuditHash(eventData.id),
    total_ballots: totalEventVotes,
    total_categories: categories.length,
    total_nominees: nominees.length,
    categories: categoryResults,
  };
}
