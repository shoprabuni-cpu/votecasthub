import Link from "next/link";

const links = [["/events", "Browse events"], ["/guides", "Guides"], ["/pricing", "Pricing"], ["/about", "About"], ["/sign-in", "Organizer sign in"]];
function NavigationLinks() {
  return <>{links.map(([href, label]) => <Link key={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-700 hover:text-emerald-800" href={href}>{label}</Link>)}<Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white! hover:bg-emerald-800" href="/sign-up">Get started</Link></>;
}
export function SiteHeader() {
  return <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-10">
    <Link className="inline-flex min-h-11 items-center gap-2 text-xl font-semibold tracking-tight text-emerald-950" href="/" aria-label="VotecastHub GH home"><span className="flex size-9 items-center justify-center rounded-xl bg-emerald-900 text-white">V</span><span>VotecastHub<span className="ml-1 text-emerald-700">GH</span></span></Link>
    <details className="lg:hidden"><summary className="cursor-pointer rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold">Menu</summary><nav aria-label="Mobile navigation" className="absolute inset-x-0 top-full grid grid-cols-2 gap-2 border-b border-stone-200 bg-white p-4"><NavigationLinks /></nav></details>
    <nav className="hidden items-center gap-5 lg:flex" aria-label="Main navigation"><NavigationLinks /></nav>
  </header>;
}
