import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    redirect("/forgot-password?notice=reset-failed");
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Choose a new password."
      description="Use a unique password with at least 12 characters. Other refresh sessions will be revoked. Existing access tokens can remain valid until they expire."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}