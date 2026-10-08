import Link from "next/link";

export function SiteHeader() {
  const link = "inline-flex min-h-11 items-center text-xs font-semibold text-stone-700 hover:text-emerald-800 sm:text-sm";
  return <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-10">
    <Link className="inline-flex min-h-11 items-center gap-2 text-xl font-semibold tracking-tight text-emerald-950" href="/" aria-label="VotecastHub GH home"><span className="flex size-9 items-center justify-center rounded-xl bg-emerald-900 text-white">V</span><span>VotecastHub<span className="ml-1 text-emerald-700">GH</span></span></Link>
    <nav className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 lg:w-auto" aria-label="Main navigation"><Link className={link} href="/events">Browse events</Link><Link className={link} href="/guides">Guides</Link><Link className={link} href="/pricing">Pricing</Link><Link className={link} href="/about">About</Link><Link className={link} href="/sign-in">Organizer sign in</Link><Link className="inline-flex min-h-11 items-center rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white hover:bg-emerald-800 sm:text-sm" href="/sign-up">Get started</Link></nav>
  </header>;
}
