import { absoluteUrl } from "./metadata";
import type { SearchPage } from "./public-data";

export const SITEMAP_PAGE_SIZE = 1000;
export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" };
export function xmlEscape(value: string) { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
export function sitemapIndex(paths: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path=>`<sitemap><loc>${xmlEscape(absoluteUrl(path))}</loc></sitemap>`).join("")}</sitemapindex>`;
}
export function sitemapUrls(pages: Array<{ path: string; updated_at?: SearchPage["updated_at"] }>) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(page=>`<url><loc>${xmlEscape(absoluteUrl(page.path))}</loc>${page.updated_at ? `<lastmod>${xmlEscape(page.updated_at)}</lastmod>` : ""}</url>`).join("")}</urlset>`;
}
