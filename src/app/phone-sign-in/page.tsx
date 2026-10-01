import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { PhoneSignInForm } from "@/components/auth/phone-sign-in-form";
import { safeNextPath } from "@/lib/auth/form-state";

export const metadata: Metadata = { title: "Verify your phone" };
type Props = { searchParams: Promise<{ next?: string }> };

export default async function PhoneSignInPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next, "/events");
  return <AuthShell eyebrow="SECURE VOTER ACCESS" title="Verify your phone" description="Use a Ghana phone number to sign in and vote in free events. The code confirms the number for vote-limit enforcement.">
    <PhoneSignInForm nextPath={nextPath} />
  </AuthShell>;
}
