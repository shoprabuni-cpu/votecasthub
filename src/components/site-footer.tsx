import Link from "next/link";
import { CookieSettingsLink } from "@/components/cookie-consent";

export function SiteFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-900 pb-20 sm:pb-12 pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-slate-900">
          {/* Brand */}
          <div className="space-y-2 max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-white font-bold text-base tracking-tight"
            >
              <span className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                V
              </span>
              <span>
                VotecastHub<span className="text-emerald-400 ml-0.5">GH</span>
              </span>
            </Link>
            <p className="text-slate-400 text-xs leading-relaxed">
              Ghana’s transparent voting platform for public awards, pageants, and campus elections. Web voting with instant mobile money verification.
            </p>
          </div>

          {/* Navigation Links */}
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-3 font-medium text-slate-300 text-xs"
          >
            <Link href="/events" className="hover:text-emerald-400 transition-colors">
              Browse Events
            </Link>
            <Link href="/about" className="hover:text-emerald-400 transition-colors">
              About
            </Link>
            <Link href="/privacy" className="hover:text-emerald-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-emerald-400 transition-colors">
              Terms of Service
            </Link>
            <CookieSettingsLink />
          </nav>
        </div>

        {/* Bottom credits */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} VotecastHub GH. All rights reserved.</p>
          <p className="flex items-center gap-1.5 text-slate-400">
            <span>Accra, Ghana</span>
            <span>🇬🇭</span>
            <span>·</span>
            <span className="text-emerald-400">MoMo Verified Platform</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
