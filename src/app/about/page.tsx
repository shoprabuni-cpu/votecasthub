import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = publicMetadata("About VotecastHub", "Learn about VotecastHub GH and how it supports event organizers and voters across Ghana.", "/about");

export default function AboutPage() {
  return <main className="public-page"><SiteHeader /><article className="legal-page about-page mx-auto w-full motion-safe:animate-[page-in_.35s_ease-out_both]">
    <p className="eyebrow">ABOUT VOTECASTHUB GH</p><h1 className="text-balance">Give every event a place to be celebrated.</h1>
    <p className="legal-lead">VotecastHub GH is a platform for organizations to publish award and competition events, introduce nominees, and share voting rules with their communities.</p>
    <section><h2>For organizers</h2><p>Create an organization workspace, set up events and categories, add nominees, and manage your event status. Team invitations and role-based access help organizations work together.</p></section>
    <section><h2>For voters</h2><p>Browse public events, read the event details and rules, and explore nominee profiles. Voting availability depends on each event’s status and its published rules.</p></section>
    <section><h2>Built with care</h2><p>We aim to make event participation clear and accessible across Ghana. We are continuing to develop secure voting, payments, USSD access, and organizer reporting. These services are not available unless shown as enabled in a specific event.</p></section>
    <div className="legal-callout"><strong>Get in touch</strong><p>For general enquiries, email <a href="mailto:info@votecasthub.com">info@votecasthub.com</a>. For help with your account, voting, or payments, email <a href="mailto:support@votecasthub.com">support@votecasthub.com</a>. VotecastHub GH currently identifies its operating location as Tanoso, Kumasi, Ghana.</p></div>
    <p className="legal-updated">Product information last reviewed: 7 October 2026.</p>
  </article><LegalFooter /></main>;
}

function LegalFooter() { return <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="mailto:support@votecasthub.com">Support</a></nav><span>© {new Date().getFullYear()} VotecastHub GH</span></footer>; }
