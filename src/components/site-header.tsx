import Link from "next/link";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { BrandLogo } from "@/components/brand-logo";

const links = [["/events", "Browse events"], ["/guides", "Guides"], ["/pricing", "Pricing"], ["/about", "About"], ["/sign-in", "Organizer sign in"]];
function NavigationLinks() {
  return <>{links.map(([href, label]) => <Link key={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-700 hover:text-emerald-800" href={href}>{label}</Link>)}<Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white! hover:bg-emerald-800" href="/sign-up">Get started</Link></>;
}
export function SiteHeader() {
  return <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur-sm sm:px-6 lg:px-10">
    <Link className="inline-flex min-h-11 items-center" href="/" aria-label="VoteCastHub GH home"><BrandLogo height={42} priority /></Link>
    <MobileNavDrawer />
    <nav className="hidden items-center gap-5 lg:flex" aria-label="Main navigation"><NavigationLinks /></nav>
  </header>;
}
