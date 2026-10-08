import type { Metadata } from "next";
import { CookieConsent } from "@/components/cookie-consent";
import { PwaBootstrap } from "@/components/pwa-bootstrap";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, siteOrigin, isPreviewDeployment, PRIVATE_ROBOTS } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "VotecastHub GH | Online voting for awards in Ghana", template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: isPreviewDeployment() ? PRIVATE_ROBOTS : { index: true, follow: true },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_GH", title: SITE_NAME, description: SITE_DESCRIPTION, images: [{ url: "/api/og", width: 1200, height: 630, alt: "VotecastHub GH — online voting for events and awards" }] },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION, images: ["/api/og"] },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "VotecastHub" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GH">
      <body>{children}<PwaBootstrap /><CookieConsent /></body>
    </html>
  );
}


