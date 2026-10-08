import { loadSearchPages } from "@/lib/seo/public-data";
import { sitemapIndex, SITEMAP_PAGE_SIZE, XML_HEADERS } from "@/lib/seo/sitemap";

export const revalidate = 300;
export async function GET() {
  try {
    const { total } = await loadSearchPages(0, 1);
    const paths = ["/sitemaps/static.xml", ...Array.from({ length: Math.ceil(total / SITEMAP_PAGE_SIZE) }, (_, i) => `/sitemaps/${i}.xml`)];
    return new Response(sitemapIndex(paths), { headers: XML_HEADERS });
  } catch {
    // A retryable error is safer than publishing an incomplete sitemap as successful.
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
  }
}
