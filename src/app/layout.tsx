import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "VotecastHub GH | Voting for events and awards", template: "%s | VotecastHub GH" },
  description: "A platform for organizers to run transparent awards and competition voting.",
  applicationName: "VotecastHub GH",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GH">
      <body>{children}</body>
    </html>
  );
}


