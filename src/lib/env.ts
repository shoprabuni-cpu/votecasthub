import { z } from "zod";

const publicEnvironment = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().refine(
    (value) => process.env.NODE_ENV !== "production" || new URL(value).protocol === "https:",
    "Supabase must use HTTPS in production.",
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().refine(
    (value) => process.env.NODE_ENV !== "production" || new URL(value).protocol === "https:",
    "The site must use HTTPS in production.",
  ),
});

export function getPublicEnvironment() {
  const parsed = publicEnvironment.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    // Field names identify setup mistakes without exposing keys or URL values.
    console.error("[Configuration] Invalid public environment", {
      fields: [...new Set(parsed.error.issues.map(issue => issue.path.join(".")))],
    });
    throw new Error("The application is not configured with valid service URLs and public keys.");
  }

  return parsed.data;
}
