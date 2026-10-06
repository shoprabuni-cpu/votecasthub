import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CookieConsent } from "@/components/cookie-consent";
import { PwaBootstrap } from "@/components/pwa-bootstrap";
import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

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
    <html lang="en-GH" className={sansFont.variable}>
      <body className="font-sans antialiased bg-[#fafbf9] text-[#0f1d16] selection:bg-[#206848]/20 selection:text-[#0f1d16] min-h-screen flex flex-col">
        {children}
        <PwaBootstrap />
        <CookieConsent />
      </body>
    </html>
  );
}
