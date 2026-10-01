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
    {email && confirmed ? <AcceptInvitationForm token={token} email={email} /> : <div className="invite-access-actions">{email && <p className="form-message" role="status">Confirm your email before accepting this invitation.</p>}<Link className="primary-link" href={`/sign-in?next=${encodeURIComponent(nextPath)}`}>Sign in to accept</Link><Link className="secondary-button" href={`/sign-up?next=${encodeURIComponent(nextPath)}`}>Create an account</Link>{email && <Link className="text-link" href={`/resend-confirmation?next=${encodeURIComponent(nextPath)}`}>Resend confirmation email</Link>}</div>}
  </AuthShell>;
}
