"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function PaymentStatusRefresh() {
  const router=useRouter();
  useEffect(()=>{let count=0;const timer=setInterval(()=>{router.refresh();if(++count>=20)clearInterval(timer);},3000);return()=>clearInterval(timer);},[router]);
  return <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" onClick={()=>router.refresh()}>Check payment status</button>;
}
