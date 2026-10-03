import "server-only";
import { createHmac } from "node:crypto";
import { paymentAdmin } from "./admin";
import { paystackSecret } from "./paystack";

export async function paystack<T>(path:string, body?:object):Promise<T> {
  const response=await fetch(`https://api.paystack.co${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${paystackSecret()}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(12000)});
  const data=await response.json();
  if(!response.ok||data.status!==true)throw new Error("Paystack request failed");
  return data.data as T;
}
export function opaque(value:string){return createHmac("sha256",paystackSecret()).update(value).digest("hex");}
export async function allow(bucket:string,limit=10,seconds=60){
  const {data,error}=await paymentAdmin().rpc("payment_rate_limit",{p_bucket:bucket,p_limit:limit,p_seconds:seconds});
  if(error)throw new Error("Rate limiter unavailable");return data===true;
}
export function siteUrl(){const url=new URL(process.env.NEXT_PUBLIC_SITE_URL||"");if(process.env.NODE_ENV==="production"&&url.protocol!=="https:")throw new Error("HTTPS site URL required");return url.origin;}
