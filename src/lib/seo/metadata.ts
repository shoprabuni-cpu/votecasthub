import type { Metadata } from "next";

export const SITE_NAME = "VotecastHub GH";
export const SITE_DESCRIPTION = "Run online voting for awards, competitions and community events in Ghana. Publish nominees, choose voter verification and share clear voting rules.";
export const PRIVATE_ROBOTS = { index: false, follow: false };

export function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
    if (process.env.NODE_ENV !== "production") return url.origin;
  }
  return "https://www.votecasthub.com";
}

export function absoluteUrl(path: string) { return new URL(path, siteOrigin()).href; }
export function isPreviewDeployment() { return process.env.VERCEL_ENV === "preview"; }

export function publicMetadata(title: string, description: string, path: string, image = "/api/og"): Metadata {
  const cleanDescription = description.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    title, description: cleanDescription,
    alternates: { canonical: absoluteUrl(path) },
    robots: isPreviewDeployment() ? PRIVATE_ROBOTS : { index: true, follow: true },
    openGraph: {
      type: "website", siteName: SITE_NAME, locale: "en_GH",
      title: `${title} | ${SITE_NAME}`, description: cleanDescription, url: absoluteUrl(path),
      images: [{ url: absoluteUrl(image), width: 1200, height: 630, alt: `${title} — ${SITE_NAME}` }],
    },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description: cleanDescription, images: [absoluteUrl(image)] },
  };
}

export const PUBLIC_STATIC_PATHS = ["/", "/events", "/about", "/pricing", "/guides", "/privacy", "/terms"];

export function jsonLd(value: unknown) {
  // User-authored event names must never be able to close a script element.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function breadcrumbs(items: Array<{ name: string; path: string }>) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: absoluteUrl(item.path) })) };
}
