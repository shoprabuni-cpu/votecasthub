import Link from "next/link";
import { DevicePreview } from "./device-preview";
import { Icon } from "@/components/icon";

export function UssdOverview({ pricing = false }: { pricing?: boolean }) {
  const button = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 cursor-pointer";
  return <section id="ussd" aria-labelledby="ussd-overview-title" className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-stone-50 p-6 sm:p-9 dark:border-[#1c2721] dark:bg-gradient-to-br dark:from-[#060e09] dark:via-[#000000] dark:to-[#080808]">
    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border-[32px] border-emerald-100/50 dark:border-emerald-950/20" />
    <div className="relative grid gap-7 lg:grid-cols-[1.3fr_1fr] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3"><span className="inline-flex size-11 items-center justify-center rounded-2xl bg-emerald-900 text-white dark:bg-emerald-600"><Icon name="phone" size={22} /></span><span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:text-emerald-400">Available by request</span></div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-emerald-800 dark:text-emerald-400">Optional USSD voting</p>
        <h2 id="ussd-overview-title" className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 dark:text-white sm:text-4xl">Vote by phone,<br />without internet.</h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-stone-600 dark:text-stone-300">Reach voters without internet or a smartphone. They dial a code, enter your event’s short number, and choose their nominee.</p>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">Add USSD to your event. Request a quote, agree on the service period, and receive dialing instructions when access is activated.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/organizer" className={`${button} bg-emerald-900 text-white! hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500`}>Request USSD access <span aria-hidden="true" className="ml-2">→</span></Link><Link href={pricing ? "/guides/vote-without-internet-ussd" : "/pricing#ussd"} className={`${button} border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:text-stone-200 dark:hover:bg-[#121914]`}>{pricing ? "How USSD works" : "See USSD costs"}</Link></div>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 dark:border-[#1c2721] dark:bg-[#0a0c0b]">
        <DevicePreview phone /><p className="mt-5 text-sm font-semibold text-stone-900 dark:text-white">One code. Three simple steps.</p>
        <ol className="mt-5 space-y-4">{[
          ["Dial", "Use the dialing code shown on your event page."],
          ["Choose", "Enter the short event number, category and nominee."],
          ["Confirm", "Review your votes. For paid voting, approve the Mobile Money payment."],
        ].map(([title, detail], index) => <li key={title} className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">{index + 1}</span><div><p className="font-semibold text-stone-900 dark:text-white">{title}</p><p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">{detail}</p></div></li>)}</ol>
        <p className="mt-5 rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-600 dark:bg-[#050706] dark:text-stone-400">Dialing instructions appear only after the event’s USSD access is activated. Network session charges, if any, are shown with the instructions.</p>
      </div>
    </div>
    {pricing && <div className="relative mt-7 grid gap-3 border-t border-emerald-100 dark:border-[#1c2721] pt-6 sm:grid-cols-3">{[
      ["Event access", "Quoted separately", "Request access in your event’s Voting settings. Review the price, service period and terms before accepting."],
      ["Votes", "Free or your set price", "Free votes cost GH₵0 per vote. Paid votes use your event price and the same 10% inclusive collection fee."],
      ["SMS credits", "Separate from USSD", "USSD voting does not consume SMS credits. Website SMS verification and any network session charges are separate."],
    ].map(([title, price, detail]) => <div key={title} className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-[#1c2721] dark:bg-[#0a0c0b]"><h3 className="text-sm font-semibold text-stone-900 dark:text-white">{title}</h3><p className="mt-2 font-semibold text-emerald-900 dark:text-emerald-400">{price}</p><p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{detail}</p></div>)}</div>}
  </section>;
}
