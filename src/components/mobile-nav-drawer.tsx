"use client";

import { StaggeredMenu } from "@/components/ui/StaggeredMenu";
import { BrandLogo } from "@/components/brand-logo";

const menuItems = [
  { label: "Browse Events", link: "/events", ariaLabel: "Browse all voting and ticketed events" },
  { label: "Official Tickets", link: "/tickets", ariaLabel: "Find and buy event tickets" },
  { label: "Awards Results", link: "/results", ariaLabel: "View awards results and standings" },
  { label: "Guides & Docs", link: "/guides", ariaLabel: "Organizer and voting guides" },
  { label: "Pricing", link: "/pricing", ariaLabel: "Platform pricing and rates" },
  { label: "About Us", link: "/about", ariaLabel: "About VoteCastHub GH" },
  { label: "Sign In", link: "/sign-in", ariaLabel: "Organizer sign in" },
  { label: "Host Event", link: "/sign-up", ariaLabel: "Create your own event" },
];

const socialItems = [
  { label: "WhatsApp (+233 59 299 2566)", link: "https://wa.me/233592992566" },
  { label: "Telegram (@VoteCastHubGH_bot)", link: "https://t.me/VoteCastHubGH_bot" },
  { label: "USSD *920#", link: "/#ussd" },
];

export function MobileNavDrawer() {
  return (
    <div className="relative lg:hidden">
      <StaggeredMenu
        position="left"
        isFixed={true}
        colors={["#041a10", "#082f1d", "#10b981"]}
        accentColor="#10b981"
        menuButtonColor="currentColor"
        openMenuButtonColor="#ffffff"
        items={menuItems}
        socialItems={socialItems}
        displaySocials={true}
        displayItemNumbering={false}
        logoComponent={<BrandLogo height={38} />}
        closeOnClickAway={true}
      />
    </div>
  );
}
