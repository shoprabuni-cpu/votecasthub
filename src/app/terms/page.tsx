import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = publicMetadata("Terms & Conditions", "Terms for organizers and participants using VotecastHub GH.", "/terms");

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-20 motion-safe:animate-[page-in_.35s_ease-out_both]">
        <p className="text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">TERMS &amp; CONDITIONS</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900 text-balance dark:text-white">Using VotecastHub GH.</h1>
        <p className="mt-6 mb-4 text-lg leading-relaxed text-stone-600 dark:text-stone-300">These terms explain your responsibilities when you create an account, organize an event, vote or buy a service through VotecastHub GH.</p>
        <p className="mb-8 text-xs text-stone-400 dark:text-stone-500">Effective date: 2 October 2026 · Last updated: 14 October 2026</p>
        <div className="my-8 rounded-2xl border-l-4 border-emerald-600 bg-emerald-50/60 p-5 text-sm leading-relaxed text-stone-700 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-stone-300">
          <strong className="block text-stone-900 dark:text-white font-semibold">Contact VotecastHub GH</strong>
          <p className="mt-1">VotecastHub GH is based in Tanoso, Kumasi, Ghana. For questions about these terms, email <a href="mailto:info@votecasthub.com" className="font-semibold text-emerald-800 underline dark:text-emerald-400">info@votecasthub.com</a>. For account, voting or payment help, email <a href="mailto:support@votecasthub.com" className="font-semibold text-emerald-800 underline dark:text-emerald-400">support@votecasthub.com</a>.</p>
        </div>
        <div className="space-y-8 divide-y divide-stone-200 dark:divide-[#1c2721]">
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">1. Agreeing to these terms</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">By creating an account, managing an event or submitting a vote or purchase, you agree to these terms. Our <Link href="/privacy" className="font-semibold text-emerald-800 underline dark:text-emerald-400">Privacy Policy</Link> explains how we handle personal information. If you act for an organization, you must have permission to do so.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">2. Accounts and team access</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Use accurate account details and keep your password and verification codes private. Report suspected unauthorized access to support. Organization owners are responsible for assigning team roles and removing access when a team member no longer needs it.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">3. Organizing an event</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">Organizers are responsible for their event’s eligibility rules, categories, nominees, voting dates, prices and announcements. You must have permission or another appropriate basis to publish nominee information and images, including any required permission for children.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Submit your event for platform approval before publication. Approval allows the event to appear on the platform; it does not replace the organizer’s responsibility for the event or its claims. Changes to an approved event may be restricted or require another review once voting or payment activity begins.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">4. Voting and results</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">Read the event’s instructions before voting. Verification, access requirements, vote limits, prices and results visibility depend on the event’s settings. A paid vote counts only after the platform verifies the payment. Starting a payment or receiving a payment prompt does not confirm a vote.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Do not bypass vote limits, create false identities, automate unauthorized votes or interfere with results. Payment reversals and refunds can affect recorded paid votes and earnings. Organizers remain responsible for award decisions and announcements outside the platform.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">5. Paid votes, fees and payouts</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">Organizers set the price per vote in Ghana cedis. Paid collections carry a 10% inclusive platform fee, which includes payment-provider processing costs. The organizer’s share is 90% before refunds or other adjustments. Current service prices are shown on the <Link href="/pricing" className="font-semibold text-emerald-800 underline dark:text-emerald-400">Pricing page</Link> or in the quote presented before purchase.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Paid events require a verified organizer payment account. Paystack processes payments, and its <a href="https://paystack.com/gh/terms" rel="noreferrer" className="font-semibold text-emerald-800 underline dark:text-emerald-400">payment terms</a> also apply where relevant. Settlement depends on the provider, account verification and transaction status. A pending balance is not a confirmed payout.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">6. Payment problems, refunds and disputes</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">If a payment is pending, check its status before paying again. If you were charged but your votes or purchase are missing, contact support with the event name, transaction reference, amount and payment date. Never send a password, Mobile Money PIN or verification code.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">We review payment problems against platform and provider records. Refund requests depend on the transaction, whether the purchased service was delivered, the event’s published terms and applicable law. An event’s terms cannot remove rights that the law gives you. Refund processing times depend on the provider and payment method.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">7. SMS and USSD services</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">SMS credits are purchased separately and used for supported SMS services. USSD event access is a separate service with a quoted price, service period and terms. Review those details before accepting and paying.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">8. Content and acceptable use</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">You retain your rights to content you upload and give VotecastHub GH permission to store, process and display it to operate your event and the platform. Do not upload unlawful, misleading or abusive content, use material without permission, impersonate another person, commit fraud or attempt to bypass security.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">9. Availability and account closure</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Maintenance, network problems and provider outages can interrupt the service. We do not guarantee continuous availability. Organizers should keep copies of important event records and communicate significant changes to participants.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">10. Responsibility and applicable law</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">VotecastHub GH provides the tools for event setup, voting and payment records. Organizers are responsible for running their events and communicating their decisions. These terms do not exclude any responsibility or consumer right that cannot legally be excluded.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">11. Updates and contact</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">We update these terms when services or conditions change and publish the updated date above. Review the terms before making a new purchase or submitting an event. Questions about these terms can be sent to <a href="mailto:info@votecasthub.com" className="font-semibold text-emerald-800 underline dark:text-emerald-400">info@votecasthub.com</a>.</p>
          </section>
        </div>
      </article>
      <footer className="mx-auto mt-16 max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6 text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <Link className="inline-flex items-center" href="/"><BrandLogo height={34} /></Link>
        <nav aria-label="Legal and company links" className="flex items-center gap-4 font-medium">
          <Link href="/about" className="hover:text-emerald-700 dark:hover:text-emerald-400">About</Link>
          <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400">Privacy</Link>
          <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400">Terms</Link>
          <a href="mailto:support@votecasthub.com" className="hover:text-emerald-700 dark:hover:text-emerald-400">Support</a>
        </nav>
        <span>© {new Date().getFullYear()} VotecastHub GH</span>
      </footer>
    </main>
  );
}
