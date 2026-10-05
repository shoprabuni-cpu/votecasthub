import "server-only";

import { createHmac } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { z } from "zod";

const MAX_BODY_BYTES = 32_768;
const hookPayload = z.object({
  user: z.object({ phone: z.string().regex(/^\+?233\d{9}$/) }),
  sms: z.object({ otp: z.string().regex(/^\d{6,8}$/) }),
});

const configuration = z.object({
  ARKESEL_API_KEY: z.string().trim().min(1).regex(/^[^\r\n]+$/),
  ARKESEL_SENDER_ID: z.string().trim().regex(/^[A-Za-z0-9 ]{1,11}$/),
  SUPABASE_SEND_SMS_HOOK_SECRET: z.string().trim().regex(/^(?:v1,)?whsec_[A-Za-z0-9+/]+={0,2}$/),
  SUPABASE_SECRET_KEY: z.string().trim().min(1).regex(/^[^\r\n]+$/),
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine((value) => new URL(value).protocol === "https:"),
  SMS_DAILY_LIMIT: z.coerce.number().int().min(1).max(10_000).default(100),
});

type Configuration = z.infer<typeof configuration>;
type Dependencies = { env?: NodeJS.ProcessEnv; fetch?: typeof fetch };

function failure(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function success() {
  // Supabase Send SMS Hooks require an empty successful response. A JSON `{}`
  // body can be treated as an invalid hook response even when the provider
  // has already accepted the SMS.
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

async function readLimitedBody(request: Request) {
  if (!request.body) throw new Error("Empty body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function rpc(config: Configuration, fetcher: typeof fetch, name: string, body: object) {
  // This client never receives browser cookies or a user Authorization header.
  const response = await fetcher(`${config.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: config.SUPABASE_SECRET_KEY,
      ...(config.SUPABASE_SECRET_KEY.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${config.SUPABASE_SECRET_KEY}` }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(800),
  });
  if (!response.ok) throw new Error("SMS guard unavailable");
  return response.json() as Promise<unknown>;
}

/** Supabase owns OTP generation, expiry and verification. This only delivers signed SMS requests. */
export async function handleArkeselSmsHook(request: Request, dependencies: Dependencies = {}) {
  const parsedConfig = configuration.safeParse(dependencies.env ?? process.env);
  if (!parsedConfig.success) return failure(503, "SMS service is not configured.");
  const config = parsedConfig.data;
  const fetcher = dependencies.fetch ?? fetch;

  const webhookId = request.headers.get("webhook-id");
  if (!webhookId || webhookId.length > 256 || !request.headers.get("webhook-signature") || !request.headers.get("webhook-timestamp")) {
    return failure(401, "Invalid SMS hook signature.");
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure(415, "Expected JSON.");
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return failure(413, "Request too large.");

  let rawBody: string;
  try {
    rawBody = await readLimitedBody(request);
  } catch {
    return failure(400, "Invalid SMS hook body.");
  }

  let verified: unknown;
  const secret = config.SUPABASE_SEND_SMS_HOOK_SECRET.replace(/^v1,/, "");
  try {
    // Standard Webhooks checks the signature over the original bytes and timestamp freshness.
    verified = new Webhook(secret).verify(rawBody, Object.fromEntries(request.headers));
  } catch {
    return failure(401, "Invalid SMS hook signature.");
  }
  const payload = hookPayload.safeParse(verified);
  if (!payload.success) return failure(400, "Only valid Ghana verification messages are supported.");

  const phone = payload.data.user.phone.replace(/^\+/, "");
  const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const requestHash = hash(`request:${webhookId}`);
  // Store neither the code nor the phone number in the delivery guard.
  try {
    const claim = await rpc(config, fetcher, "claim_sms_delivery", {
      p_request_hash: requestHash,
      p_recipient_hash: hash(`phone:${phone}`),
      p_daily_limit: config.SMS_DAILY_LIMIT,
    });
    if (claim === "sent") return success();
    if (claim === "rate_limited") return failure(429, "SMS request limit reached. Please try again later.");
    if (claim !== "claimed") return failure(503, "This SMS request cannot be resent. Request a new code shortly.");
  } catch {
    return failure(503, "SMS service is temporarily unavailable.");
  }

  let accepted = false;
  try {
    const response = await fetcher("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "api-key": config.ARKESEL_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: config.ARKESEL_SENDER_ID,
        recipients: [phone],
        message: `Your VotecastHub verification code is ${payload.data.sms.otp}. Do not share this code.`,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.ok) {
      // Arkesel has returned several valid response shapes over time (the v2
      // endpoint may return an object, an array, or only a status message).
      // HTTP 2xx is the provider's acceptance signal; only an explicit error
      // status should be treated as a failed send. The SMS provider has already
      // accepted the OTP at this point, so rejecting an unfamiliar success
      // payload would show a false failure to the voter.
      let result: unknown = null;
      try { result = await response.json(); } catch { /* empty 2xx body */ }
      const status = typeof result === "object" && result !== null && "status" in result
        ? String((result as { status?: unknown }).status).toLowerCase()
        : "";
      accepted = !["error", "failed", "failure"].includes(status);
      console.info("sms_hook_provider_result", { httpStatus: response.status, providerStatus: status || "omitted", accepted });
    } else {
      console.error("sms_hook_provider_http_error", { httpStatus: response.status });
    }
  } catch {
    // Do not log provider bodies, exceptions, OTPs, keys, or phone numbers.
    // An ambiguous timeout must never trigger an automatic second paid send.
  }

  try {
    await rpc(config, fetcher, "finish_sms_delivery", { p_request_hash: requestHash, p_sent: accepted });
  } catch {
    // The provider has already accepted the OTP. Do not turn a successful SMS
    // into an auth failure if the receipt write is temporarily unavailable;
    // Supabase must still receive a 2xx response so the voter can enter it.
    console.error("sms_hook_receipt_write_failed");
    if (!accepted) return failure(503, "SMS service is temporarily unavailable.");
  }
  if (!accepted) {
    console.error("sms_hook_provider_request_failed");
    return failure(502, "Unable to send verification code. Please try again shortly.");
  }
  return success();
}
