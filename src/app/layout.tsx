import type { Metadata } from "next";
import { CookieConsent } from "@/components/cookie-consent";
import { PwaBootstrap } from "@/components/pwa-bootstrap";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "VotecastHub GH | Voting for events and awards", template: "%s | VotecastHub GH" },
  description: "A platform for organizers to run transparent awards and competition voting.",
  applicationName: "VotecastHub GH",
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


