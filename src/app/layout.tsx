import type { Metadata, Viewport } from "next";
import { CookieConsent } from "@/components/cookie-consent";
import { PwaBootstrap } from "@/components/pwa-bootstrap";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, siteOrigin, isPreviewDeployment, PRIVATE_ROBOTS } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

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
  icons: { icon: "/images/votecasthub-logo.png", apple: "/images/votecasthub-logo.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "VoteCastHub" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GH" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://jjgwyvxntzrjugauknzo.supabase.co" />
        <link rel="dns-prefetch" href="https://jjgwyvxntzrjugauknzo.supabase.co" />
        <link rel="preconnect" href="https://api.paystack.co" />
        <link rel="dns-prefetch" href="https://api.paystack.co" />
        <link rel="preconnect" href="https://js.paystack.co" />
        <link rel="dns-prefetch" href="https://js.paystack.co" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('vch-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=t==='dark'||(!t&&d);if(dark){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}<PwaBootstrap /><CookieConsent /></body>
    </html>
  );
}


