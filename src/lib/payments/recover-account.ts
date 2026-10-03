import "server-only";
import { paymentAdmin } from "./admin";
import { paystack } from "./gateway";
type Account={subaccount_code:string;business_name:string;settlement_bank:string;account_number:string;account_name:string;percentage_charge:number;is_verified:boolean;active:boolean;currency:string;metadata:unknown};
export async function recoverAccount(organizationId:string){
 const db=paymentAdmin();const {data:claim,error}=await db.from("paystack_account_requests").select("organization_id").eq("organization_id",organizationId).maybeSingle();if(error)throw error;if(!claim)return null;
 const matches:Account[]=[];let complete=false;
 for(let page=1;page<=10;page++){
  const accounts=await paystack<Account[]>(`/subaccount?perPage=100&page=${page}`);
  for(const account of accounts){
   let metadata=account.metadata;if(typeof metadata==="string"){try{metadata=JSON.parse(metadata);}catch{continue;}}
   if(metadata&&typeof metadata==="object"&&"organization_id" in metadata&&metadata.organization_id===organizationId)matches.push(account);
  }
  if(accounts.length<100){complete=true;break;}
 }
 if(!complete||matches.length!==1)throw new Error("Support must reconcile this account request");
 const a=matches[0];
 if(!/^ACCT_[A-Za-z0-9]+$/.test(a.subaccount_code)||!/^\d{4}$/.test(a.account_number.slice(-4)))throw new Error("Invalid recovered account");
 const {error:save}=await db.from("organization_paystack_accounts").insert({organization_id:organizationId,subaccount_code:a.subaccount_code,business_name:a.business_name,settlement_bank:a.settlement_bank,account_last4:a.account_number.slice(-4),account_name:a.account_name||null,percentage_charge:10,paystack_verified:a.is_verified===true,status:a.is_verified&&a.active&&a.currency==="GHS"&&Number(a.percentage_charge)===10?"active":"pending"});
 if(save&&save.code!=="23505")throw save;
 return {subaccount_code:a.subaccount_code};
}
