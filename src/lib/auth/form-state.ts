export type AuthFormState = {
  message: string;
  success?: boolean;
  codeSent?: boolean;
  resendAt?: number;
  phone?: string;
  email?: string;
  next?: string;
  nextRequestKey?: string;
  inviteUrl?: string;
} | null;

export function safeNextPath(value: string | null | undefined, fallback = "/organizer") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
