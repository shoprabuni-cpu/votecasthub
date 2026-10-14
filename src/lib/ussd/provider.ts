import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Internal adapter contract, not an assertion about Arkesel's native API.
export function ussdSimulatorMode() { return process.env.USSD_SIMULATOR_MODE === "true" && (process.env.USSD_PAYMENT_PROVIDER ?? "paystack") === "paystack" && process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_") === true; }
export function ussdSimulatorEventAllowed(eventId:string) { return ussdSimulatorMode() && (process.env.USSD_SIMULATOR_EVENT_IDS ?? "").split(",").map(value=>value.trim()).includes(eventId); }
const configSchema = z.object({
  USSD_ENABLED: z.literal("true"), USSD_ADAPTER_CONTRACT: z.literal("normalized-v1").default("normalized-v1"),
  USSD_PAYMENT_PROVIDER: z.enum(["paystack", "adapter"]).default("paystack"),
  USSD_SESSION_PROTOCOL: z.enum(["normalized-v1", "arkesel-json"]).default("normalized-v1"),
  ARKESEL_USSD_USER_ID: z.preprocess(value => value === "" ? undefined : value, z.string().min(1).max(128).optional()), ARKESEL_USSD_CALLBACK_TOKEN: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  ARKESEL_USSD_SHARED_SECRET: z.string().min(32), ARKESEL_USSD_SERVICE_CODE: z.string().regex(/^\*[0-9*]{2,30}#$/),
  USSD_ADAPTER_URL: z.preprocess(value => value === "" ? undefined : value, z.url().refine(value => new URL(value).protocol === "https:" && !new URL(value).username && !new URL(value).password).optional()),
  USSD_ADAPTER_TOKEN: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()), USSD_PAYMENT_MODE: z.enum(["live", "test"]).default("test"),
}).refine(value => value.USSD_SESSION_PROTOCOL === "arkesel-json" ? Boolean((value.ARKESEL_USSD_USER_ID || ussdSimulatorMode()) && value.ARKESEL_USSD_CALLBACK_TOKEN) : Boolean(value.USSD_ADAPTER_URL && value.USSD_ADAPTER_TOKEN), "Configure credentials for the selected session protocol");
export function ussdPaymentReady() { const config = ussdConfiguration(); return config.success && (config.data.USSD_PAYMENT_PROVIDER === "paystack" ? Boolean(process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_")) : Boolean(config.data.USSD_ADAPTER_URL && config.data.USSD_ADAPTER_TOKEN)); }
export function ussdConfiguration() {
  if(process.env.USSD_SIMULATOR_MODE === "true" && !ussdSimulatorMode())return {success:false as const};
  return configSchema.safeParse(process.env);
}
export function authenticUssd(request: Request, raw: string, secret: string) {
  const timestamp = request.headers.get("x-vch-timestamp") ?? "";
  const signature = request.headers.get("x-vch-signature") ?? "";
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
const transaction = z.object({ reference: z.string(), transactionId: z.number().int().positive().safe(), mode: z.enum(["live", "test"]), status: z.enum(["pending", "success", "failed", "reversed"]), amount: z.number().int().positive().safe(), currency: z.literal("GHS"), fees: z.number().int().nonnegative().safe() });
export async function adapterRequest(path: string, body?: object) {
  const config = ussdConfiguration(); if (!config.success || !config.data.USSD_ADAPTER_URL || !config.data.USSD_ADAPTER_TOKEN) throw new Error("USSD payment adapter unavailable");
  const url = `${config.data.USSD_ADAPTER_URL.replace(/\/$/, "")}${path}`;
  const result = await fetch(url, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${config.data.USSD_ADAPTER_TOKEN}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(4000) });
  if (!result.ok) throw new Error("USSD adapter request failed");
  return result.json();
}
export async function verifiedUssdTransaction(reference: string) {
  const result = transaction.parse(await adapterRequest(`/payments/${encodeURIComponent(reference)}`));
  const config = ussdConfiguration();
  if (!config.success || result.mode !== config.data.USSD_PAYMENT_MODE) throw new Error("USSD payment mode mismatch");
  if (result.reference !== reference) throw new Error("USSD reference mismatch");
  return result;
}
