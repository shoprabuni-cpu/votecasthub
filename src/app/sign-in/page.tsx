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
    {confirmationFailed && <p className="form-message" role="alert">We could not confirm that link. Request a new confirmation email and try again.</p>}
    {passwordUpdated && <p className="form-message form-success" role="status">Your password was updated. Sign in with your new password.</p>}
    <SignInForm nextPath={nextPath} />
  </AuthShell>;
}
