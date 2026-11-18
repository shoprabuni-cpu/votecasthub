import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNextPath } from "@/lib/auth/form-state";

export const metadata: Metadata = { title: "Sign in" };

type PageProps = { searchParams: Promise<{ next?: string | string[]; notice?: string | string[] }> };

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(typeof params.next === "string" ? params.next : null);
  const confirmationFailed = params.notice === "confirmation-failed";
  const passwordUpdated = params.notice === "password-updated";
  return <AuthShell eyebrow="ORGANIZER ACCESS" title="Welcome back." description="Sign in to manage your events and voting." >
    {confirmationFailed && <p className="my-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="alert">We could not confirm that link. Request a new confirmation email and try again.</p>}
    {passwordUpdated && <p className="my-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300" role="status">Your password was updated. Sign in with your new password.</p>}
    <SignInForm nextPath={nextPath} />
  </AuthShell>;
}
