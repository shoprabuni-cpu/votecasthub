import Link from "next/link";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { href: "/events", label: "Browse events", livePulse: true },
  { href: "/tickets", label: "Find tickets" },
  { href: "/results", label: "Awards results" },
  { href: "/guides", label: "Guides" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/sign-in", label: "Organizer sign in" },
];

function NavigationLinks() {
  return (
    <>
      <div className="flex items-center gap-1 xl:gap-2">
        {navLinks.map(({ href, label, livePulse }) => (
          <Link
            key={href}
            className="group relative inline-flex min-h-10 items-center rounded-xl px-3 py-1.5 text-sm font-medium text-stone-700 transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-900 active:scale-[0.98] dark:text-stone-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
            href={href}
          >
            {livePulse && (
              <span className="relative mr-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
            <span>{label}</span>
            <span className="absolute bottom-1 left-3 right-3 h-0.5 scale-x-0 rounded-full bg-emerald-600 transition-transform duration-300 ease-out group-hover:scale-x-100 dark:bg-emerald-400" />
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3 pl-2">
        <ThemeToggle />
        <Link
          className="group relative inline-flex min-h-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 px-5 text-sm font-semibold text-white shadow-md shadow-emerald-950/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-900/30 active:scale-[0.98] dark:from-emerald-600 dark:via-emerald-500 dark:to-emerald-600 dark:shadow-emerald-900/40"
          href="/sign-up"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            <span>Get started</span>
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </span>
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        </Link>
      </div>
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-stone-200/80 bg-white/85 px-4 py-2.5 backdrop-blur-xl transition-all duration-300 sm:px-6 lg:px-10 dark:border-emerald-950/40 dark:bg-[#060a08]/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left: Mobile Nav Drawer + Enlarged Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <MobileNavDrawer />
          <Link
            className="group inline-flex min-h-11 items-center transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
            href="/"
            aria-label="VoteCastHub GH home"
          >
            <BrandLogo height={48} priority />
          </Link>
        </div>

        {/* Mobile Right: Theme toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
        </div>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          <NavigationLinks />
        </nav>
      </div>

      {/* Subtle bottom gradient glow accent line */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent dark:via-emerald-400/20"
        aria-hidden="true"
      />
    </header>
  );
}
