import { PUBLIC_STATIC_PATHS } from "@/lib/seo/metadata";
import { GUIDES } from "@/lib/seo/guides";
import { loadSearchPages } from "@/lib/seo/public-data";
import { sitemapUrls, SITEMAP_PAGE_SIZE, XML_HEADERS } from "@/lib/seo/sitemap";

export const revalidate = 300;
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === "static.xml") return new Response(sitemapUrls([...PUBLIC_STATIC_PATHS, ...GUIDES.map(guide => `/guides/${guide.slug}`)].map(path => ({ path }))), { headers: XML_HEADERS });
  if (!/^(0|[1-9]\d{0,5})\.xml$/.test(file)) return new Response("Not found", { status: 404 });
  try {
    const offset = Number(file.slice(0, -4)) * SITEMAP_PAGE_SIZE;
    const { pages, total } = await loadSearchPages(offset, SITEMAP_PAGE_SIZE);
    if (offset >= total) return new Response("Not found", { status: 404 });
    return new Response(sitemapUrls(pages), { headers: XML_HEADERS });
  } catch { return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } }); }
}
