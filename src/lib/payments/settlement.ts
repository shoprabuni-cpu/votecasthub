import "server-only";
import { paystackSecret } from "./paystack";

export async function settlementProviders(type: string) {
  const query = new URLSearchParams({ country: "ghana", currency: "GHS", type, use_cursor: "false", perPage: "100" });
  const response = await fetch(`https://api.paystack.co/bank?${query}`, { headers: { Authorization: `Bearer ${paystackSecret()}` }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  const body = await response.json();
  if (!response.ok || !body.status || !Array.isArray(body.data)) throw new Error("Provider list unavailable. Please try again.");
  return (body.data as Array<{name:string;code:string;active?:boolean}>).filter(p => p.active !== false).map(p => ({ name:p.name, code:p.code }));
}

export async function resolveSettlement(type: string, bankCode: string, number: string) {
  let accountNumber = number.replace(/[\s()-]/g, "");
  if (type === "mobile_money") accountNumber = accountNumber.replace(/^\+?233/, "0");
  if (!(type === "mobile_money" ? /^0\d{9}$/ : /^\d{6,20}$/).test(accountNumber)) throw new Error("Enter a valid account or Ghana mobile money number.");
  const providers = await settlementProviders(type);
  if (!providers.some(p => p.code === bankCode)) throw new Error("Choose a supported bank or mobile money network.");
  const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
  const response = await fetch(`https://api.paystack.co/bank/resolve?${query}`, { headers: { Authorization: `Bearer ${paystackSecret()}` }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  const body = await response.json();
  if (!response.ok || !body.status || typeof body.data?.account_name !== "string" || !body.data.account_name.trim()) throw new Error("Paystack could not confirm the account name. Check the number and provider, or try another account.");
  return { accountNumber, accountName: body.data.account_name.trim() as string };
}
