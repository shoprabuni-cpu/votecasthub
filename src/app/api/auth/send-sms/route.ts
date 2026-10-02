import { handleArkeselSmsHook } from "@/lib/sms/arkesel-hook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleArkeselSmsHook(request);
}
