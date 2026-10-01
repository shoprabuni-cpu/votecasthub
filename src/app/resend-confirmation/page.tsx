import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { safeNextPath } from "@/lib/auth/form-state";

export const metadata: Metadata = { title: "Resend confirmation email" };
type Props = { searchParams: Promise<{ next?: string }> };

export default async function ResendConfirmationPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  return (
    <AuthShell
      eyebrow="EMAIL CONFIRMATION"
      title="Need another confirmation link?"
      description="Enter your email address. If it has a pending confirmation, we will send a new link."
    >
      <ResendConfirmationForm nextPath={nextPath} />
    </AuthShell>
  );
}
