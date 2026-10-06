"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/icon";

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#fafbf9]/85 border-b border-emerald-950/8 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-emerald-600 rounded-lg p-1"
            aria-label="VotecastHub GH home"
          >
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              V
            </span>
            <span className="font-bold text-lg tracking-tight text-slate-900">
              VotecastHub<span className="text-emerald-700 ml-0.5">GH</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <Link
              href="/events"
              className="hover:text-emerald-800 transition-colors py-1"
            >
              Browse Events
            </Link>
            <a
              href="#how-it-works"
              className="hover:text-emerald-800 transition-colors py-1"
            >
              How It Works
            </a>
            <a
              href="#solutions"
              className="hover:text-emerald-800 transition-colors py-1"
            >
              Solutions
            </a>
            <Link
              href="/about"
              className="hover:text-emerald-800 transition-colors py-1"
            >
              About
            </Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-900 transition-colors"
            >
              Organizer Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-sm active:scale-95 transition-all"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl text-slate-700 hover:bg-emerald-50 active:scale-95 transition-all"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            <Icon name={mobileMenuOpen ? "close" : "menu"} size={22} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer (Native App Experience) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm md:hidden"
            />

            {/* Slide-out Sheet */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xs bg-white shadow-2xl p-6 flex flex-col justify-between md:hidden"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs">
                      V
                    </span>
                    <span className="font-bold text-base text-slate-900">
                      VotecastHub<span className="text-emerald-700">GH</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95"
                    aria-label="Close menu"
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>

                {/* Nav Links */}
                <div className="py-6 flex flex-col gap-2">
                  <Link
                    href="/events"
                    className="px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-between"
                  >
                    <span>Browse Events</span>
                    <Icon name="chevronRight" size={16} className="text-slate-400" />
                  </Link>
                  <a
                    href="#how-it-works"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-between"
                  >
                    <span>How It Works</span>
                    <Icon name="chevronRight" size={16} className="text-slate-400" />
                  </a>
                  <a
                    href="#solutions"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-between"
                  >
                    <span>For Organizers</span>
                    <Icon name="chevronRight" size={16} className="text-slate-400" />
                  </a>
                  <Link
                    href="/about"
                    className="px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-between"
                  >
                    <span>About Us</span>
                    <Icon name="chevronRight" size={16} className="text-slate-400" />
                  </Link>
                </div>
              </div>

              {/* Drawer Bottom Actions */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <Link
                  href="/sign-in"
                  className="w-full py-3 px-4 rounded-xl text-center text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 block active:scale-95"
                >
                  Organizer Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="w-full py-3 px-4 rounded-xl text-center text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 block shadow-sm active:scale-95"
                >
                  Create Organizer Account
                </Link>
                <p className="text-[11px] text-center text-slate-400 pt-2">
                  Voting platform built for Ghana 🇬🇭
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
