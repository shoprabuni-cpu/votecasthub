import "server-only";
import { paymentAdmin } from "./admin";
import { opaque,paystack } from "./gateway";
export async function reserveCheckout(requestKey:string,details:object,reference:string){
  const db=paymentAdmin();const fingerprint=opaque(JSON.stringify(details));
  const {error}=await db.from("checkout_sessions").insert({request_key:requestKey,fingerprint,reference});
  if(!error)return {fresh:true,reference,url:null};
  if(error.code!=="23505")throw error;
  const {data,error:read}=await db.from("checkout_sessions").select("fingerprint,reference,authorization_url").eq("request_key",requestKey).single();
  if(read||data.fingerprint!==fingerprint)throw new Error("Checkout identity mismatch");
  return {fresh:false,reference:data.reference,url:data.authorization_url};
}
export async function initializeCheckout(reference:string,body:object){
  const data=await paystack<{authorization_url:string}>("/transaction/initialize",{...body,reference});
  const url=new URL(data.authorization_url);
  if(url.protocol!=="https:"||url.hostname!=="checkout.paystack.com")throw new Error("Invalid checkout URL");
  const {error}=await paymentAdmin().from("checkout_sessions").update({authorization_url:url.href}).eq("reference",reference);if(error)throw error;
  return url.href;
}
