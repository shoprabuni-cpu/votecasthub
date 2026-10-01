import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeNextPath } from "@/lib/auth/form-state";

export const metadata: Metadata = { title: "Create an organizer account" };
type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  return <AuthShell eyebrow="GET STARTED" title="Bring your event together." description="Create an organizer account. We will ask you to confirm your email before you can manage an event.">
    <SignUpForm nextPath={nextPath} />
  </AuthShell>;
}
