import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { CookieSettingsLink } from "@/components/cookie-consent";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = publicMetadata("Privacy Policy", "How VotecastHub GH uses your information for accounts, events, voting and payments.", "/privacy");

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-20 motion-safe:animate-[page-in_.35s_ease-out_both]">
        <p className="text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">PRIVACY POLICY</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900 text-balance dark:text-white">How we use your information.</h1>
        <p className="mt-6 mb-4 text-lg leading-relaxed text-stone-600 dark:text-stone-300">This policy explains what VotecastHub GH collects when you create an account, organize an event, vote or make a payment, and how to contact us about your data.</p>
        <p className="mb-8 text-xs text-stone-400 dark:text-stone-500">Effective date: 2 October 2026 · Last updated: 14 October 2026</p>
        <div className="my-8 rounded-2xl border-l-4 border-emerald-600 bg-emerald-50/60 p-5 text-sm leading-relaxed text-stone-700 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-stone-300">
          <strong className="block text-stone-900 dark:text-white font-semibold">Contact VotecastHub GH</strong>
          <p className="mt-1">VotecastHub GH is based in Tanoso, Kumasi, Ghana. For privacy questions or requests, email <a href="mailto:support@votecasthub.com" className="font-semibold text-emerald-800 underline dark:text-emerald-400">support@votecasthub.com</a>.</p>
        </div>
        <div className="space-y-8 divide-y divide-stone-200 dark:divide-[#1c2721]">
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              <li><strong>Your account:</strong> your display name, email address, phone number when used for sign-in or verification, and account and session records.</li>
              <li><strong>Your events:</strong> organizer and team details, event names, dates, voting settings, categories, nominee profiles and uploaded images. If an organizer uses a voter list or access code, we also process the details needed to check eligibility.</li>
              <li><strong>Your votes:</strong> the event, category, nominee, number of votes and the account or voter identifier used to apply the event’s rules.</li>
              <li><strong>Your payments:</strong> payment references, amounts, status and receipt details. Paid voting and other purchases may require an email address. Mobile Money payments also use your phone number and network. Organizers provide payout account details when setting up payments.</li>
              <li><strong>Site activity:</strong> request, browser, device and security information needed to deliver the site and investigate problems, along with your saved cookie preferences.</li>
            </ul>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">What we use it for</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">We use this information to sign you in, publish events, check voter eligibility, enforce vote limits, record votes, process payments and payouts, send verification codes, and answer support requests. We also use payment and security records to investigate failed transactions, refunds, disputed votes and suspected misuse.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Phone verification and USSD</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">When an event requires phone verification, we use your number to send a one-time code and link your participation to a verified voter identity. This helps apply vote limits across supported voting channels. Your phone number is not displayed on public event pages.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">When you use USSD on an activated event, the gateway sends us your phone number, network, session identifier and menu responses. We use these details to guide your session, identify the event and nominee, and record your vote or payment request. Paid USSD voting also asks for a receipt email. Only enter information requested by the voting menu.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Payments</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">Paystack processes payments for paid votes and platform purchases. We send the transaction details needed to request and verify a payment, and keep the reference and outcome so we can record a purchase, confirm votes or resolve a payment problem. For Mobile Money, Paystack also receives the phone number and network used for the charge.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Enter card details and your Mobile Money PIN only through the payment provider’s secure flow or your network’s approval prompt. Do not send them to our support team.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Who can see information</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">Published event details, nominee names, biographies and images are public. Results are displayed according to the event’s settings. Authorized organizers and team members can access the event management information available to their roles. Platform administrators can access information needed for support, approvals, payments and security.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Our service providers receive the information needed to perform their part of the service: Supabase for accounts and data storage, Vercel for hosting, Paystack for payments, and Arkesel for configured SMS delivery and USSD sessions. Their services may process information outside Ghana. Information may also be disclosed where required by law.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Cookies and browser storage</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">We use essential cookies and browser storage to keep you signed in and support security. Your cookie choices are saved in this browser. Optional analytics and marketing tracking require your permission; saving a preference does not itself activate a tracking service. You can change these choices below.</p>
            <CookieSettingsLink />
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Keeping and protecting records</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 mb-3">Account information supports your access to the platform. Event and vote records support results and vote-limit checks. Payment, refund and audit records support reconciliation, disputes and legal requirements. Closing or deleting an event does not necessarily delete the related financial or security records.</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">To request deletion of your personal information, contact us. Some records may need to be retained to resolve a transaction, protect an active vote or meet a legal obligation. We use account permissions and service security controls to restrict access to data.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Your requests and privacy rights</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">You can contact us to request access to your personal information, correct inaccurate details, ask for deletion, or raise a concern about its use. We may need to verify your identity before handling a request. Requests are handled subject to Ghana’s Data Protection Act, 2012 (Act 843). You can also contact the <a href="https://dpc.gov.gh/for-individuals/" rel="noreferrer" className="font-semibold text-emerald-800 underline dark:text-emerald-400">Ghana Data Protection Commission</a> about your rights or a complaint.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Nominee information and children</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Organizers must have permission or another appropriate basis to upload nominee information and photographs. Where nominees are children, organizers must obtain any required permission from a parent or guardian. Contact us if you believe an event includes personal information or an image that should not have been published.</p>
          </section>
          <section className="pt-6">
            <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-3">Updates and contact</h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">We update this policy when our services or data practices change. The date above shows the latest update. Send privacy requests to <a href="mailto:support@votecasthub.com" className="font-semibold text-emerald-800 underline dark:text-emerald-400">support@votecasthub.com</a>, and include enough detail for us to identify the account or event concerned. Do not include passwords, payment PINs or verification codes.</p>
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
