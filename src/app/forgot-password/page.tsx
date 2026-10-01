import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

type PageProps = { searchParams: Promise<{ notice?: string | string[] }> };

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const resetFailed = params.notice === "reset-failed";
  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Reset your password."
      description="Enter the email address for your organizer account. If it matches an account, we will send a secure reset link."
    >
      {resetFailed && <p className="form-message" role="alert">That reset link is invalid or expired. Request a new one.</p>}
      <ForgotPasswordForm />
    </AuthShell>
  );
}