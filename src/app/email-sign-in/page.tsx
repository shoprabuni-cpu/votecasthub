import { EmailOtpForm } from "@/components/auth/email-otp-form";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function EmailSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between w-full max-w-md mx-auto mb-3 px-2">
        <Link className="inline-flex items-center min-h-11" href="/" aria-label="VoteCastHub GH home">
          <BrandLogo height={42} priority />
        </Link>
        <ThemeToggle />
      </div>
      <section className="mx-auto w-full max-w-md my-auto rounded-3xl border border-stone-200 bg-white p-8 sm:p-10 shadow-xl dark:border-[#1c2721] dark:bg-[#0c120e]">
        <p className="text-xs font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">VOTER VERIFICATION</p>
        <h1 className="mt-3 font-serif text-2xl sm:text-3xl font-medium tracking-tight text-stone-900 dark:text-white">Verify your email</h1>
        <p className="mt-2 mb-6 text-sm text-stone-600 dark:text-stone-300 leading-relaxed">Use email verification for events that allow it.</p>
        <EmailOtpForm nextPath={next?.startsWith("/") ? next : "/events"} />
      </section>
      <div className="text-center text-xs text-stone-400 dark:text-stone-500 py-4">
        © {new Date().getFullYear()} VoteCastHub GH
      </div>
    </main>
  );
}
