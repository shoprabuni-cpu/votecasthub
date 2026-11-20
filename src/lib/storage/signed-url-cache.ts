import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CacheEntry {
  url: string;
  expiresAt: number;
}

// In-memory cache across server requests in the Node/Edge runtime
const signedUrlCache = new Map<string, CacheEntry>();

// Keep cache size bounded to prevent memory leaks
const MAX_CACHE_SIZE = 5000;
const CACHE_TTL_SECONDS = 3300; // 55 minutes (signed URL valid for 60 mins)

/**
 * High-performance cached storage URL signer.
 * Reuses active signed URLs within their validity window, eliminating redundant
 * HTTP roundtrips to Supabase Storage on every page render.
 */
export async function getCachedSignedUrls(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const now = Date.now();
  const missingPaths: string[] = [];

  for (const path of paths) {
    if (!path) continue;
    const cacheKey = `${bucket}:${path}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      result.set(path, cached.url);
    } else {
      missingPaths.push(path);
    }
  }

  if (missingPaths.length === 0) {
    return result;
  }

  // De-duplicate missing paths
  const uniqueMissing = [...new Set(missingPaths)];

  try {
    const { data: signedImages, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(uniqueMissing, expiresIn);

    if (error) {
      console.error("Failed to sign storage URLs:", error.message);
      return result;
    }

    const expiresAt = now + Math.min(expiresIn, CACHE_TTL_SECONDS) * 1000;

    for (const img of signedImages ?? []) {
      if (img.path && img.signedUrl) {
        result.set(img.path, img.signedUrl);
        const cacheKey = `${bucket}:${img.path}`;

        // Evict oldest entry if cache exceeds max size
        if (signedUrlCache.size >= MAX_CACHE_SIZE) {
          const firstKey = signedUrlCache.keys().next().value;
          if (firstKey) signedUrlCache.delete(firstKey);
        }

        signedUrlCache.set(cacheKey, {
          url: img.signedUrl,
          expiresAt,
        });
      }
    }

    // Negative cache for paths that failed to sign so we don't re-query missing files on every request
    for (const missing of uniqueMissing) {
      if (!result.has(missing)) {
        signedUrlCache.set(`${bucket}:${missing}`, {
          url: "",
          expiresAt: now + 300000, // 5 min negative cache
        });
      }
    }
  } catch (err) {
    console.error("Exception signing storage URLs:", err);
  }

  return result;
}

/**
 * Single-path helper for getCachedSignedUrls.
 */
export async function getCachedSignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!path) return null;
  const urls = await getCachedSignedUrls(supabase, bucket, [path], expiresIn);
  return urls.get(path) ?? null;
}
