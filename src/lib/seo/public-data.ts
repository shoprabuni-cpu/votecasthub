import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

export function publicSearchClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Public search data is not configured");
  // No session cookies or service key: search responses are identical for every visitor.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export type PublicSearchMetadata = { name: string; description: string | null; event_name: string; path: string };
export const loadPublicSearchMetadata = cache(async (slug: string, nomineeId?: string): Promise<PublicSearchMetadata | null> => {
  const { data, error } = await publicSearchClient().rpc("get_public_search_metadata", { p_slug: slug, p_nominee_id: nomineeId ?? null });
  if (error) throw new Error("Public search metadata unavailable", { cause: error });
  return data as PublicSearchMetadata | null;
});

export type SearchPage = { path: string; updated_at: string };
export async function loadSearchPages(offset: number, limit: number): Promise<{ total: number; pages: SearchPage[] }> {
  const { data, error } = await publicSearchClient().rpc("get_public_search_pages", { p_offset: offset, p_limit: limit });
  if (error) throw new Error("Sitemap data unavailable", { cause: error });
  return data as { total: number; pages: SearchPage[] };
}
