import "server-only";
import { z } from "zod";
export const smsPackages = { 100: { credits: 100, amountMinor: 500 }, 500: { credits: 500, amountMinor: 8000 }, 1000: { credits: 1000, amountMinor: 15000 } } as const;
export const packageSchema = z.coerce.number().refine((v): v is keyof typeof smsPackages => v in smsPackages);
export function paystackSecret() { const value = process.env.PAYSTACK_SECRET_KEY; if (!value?.startsWith("sk_")) throw new Error("Paystack is not configured"); return value; }
