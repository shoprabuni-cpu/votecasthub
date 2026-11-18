import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInvitationForm } from "@/components/organizations/accept-invitation-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Organization invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const nextPath = `/invite/${token}`;
  let email: string | null = null;
  let confirmed = false;
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    email = user.user?.email ?? null;
    confirmed = Boolean(user.user?.email_confirmed_at);
  } catch { /* The invitation remains private; the user can retry sign-in. */ }

  return <AuthShell eyebrow="TEAM INVITATION" title="Join an organization." description="Accept the invitation using the confirmed email address it was sent to.">
    {email && confirmed ? (
      <AcceptInvitationForm token={token} email={email} />
    ) : (
      <div className="mt-6 flex flex-col gap-3">
        {email && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="status">Confirm your email before accepting this invitation.</p>}
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500" href={`/sign-in?next=${encodeURIComponent(nextPath)}`}>Sign in to accept</Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 shadow-2xs transition hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200" href={`/sign-up?next=${encodeURIComponent(nextPath)}`}>Create an account</Link>
        {email && <Link className="mt-2 text-center text-xs font-semibold text-emerald-800 underline dark:text-emerald-400" href={`/resend-confirmation?next=${encodeURIComponent(nextPath)}`}>Resend confirmation email</Link>}
      </div>
    )}
  </AuthShell>;
}
