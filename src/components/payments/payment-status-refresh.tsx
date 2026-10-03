"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function PaymentStatusRefresh() {
  const router=useRouter();
  useEffect(()=>{let count=0;const timer=setInterval(()=>{router.refresh();if(++count>=20)clearInterval(timer);},3000);return()=>clearInterval(timer);},[router]);
  return <button type="button" className="primary-link" onClick={()=>router.refresh()}>Check payment status</button>;
}
