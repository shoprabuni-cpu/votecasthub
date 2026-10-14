import Image from "next/image";

/** Decorative examples use HTML text so menus stay sharp at every screen size. */
export function DevicePreview({ phone = false }: { phone?: boolean }) {
  if (phone) return <figure className="mx-auto w-full max-w-[240px]">
    <div aria-hidden="true" className="relative aspect-square motion-safe:transition-transform motion-safe:duration-500 motion-safe:hover:-translate-y-1">
      <Image src="/images/Classic Black Feature Phone Cutout.png" alt="" fill sizes="240px" className="object-contain" />
      <div className="absolute left-[41%] top-[18%] h-[21%] w-[20%] -rotate-2 bg-[#cbd3c9] px-1 py-2 font-mono text-[7px] leading-tight text-stone-950 sm:text-[8px]">VotecastHub GH<br /><br />1. Vote<br />2. Exit</div>
    </div>
    <figcaption className="text-center text-xs text-stone-500">Example voting menu</figcaption>
  </figure>;

  return <figure className="w-full">
    <div aria-hidden="true" className="relative aspect-[1402/1122] motion-safe:transition-transform motion-safe:duration-500 motion-safe:hover:-translate-y-1">
      <Image src="/images/Graphite Laptop and Smartphone Mockup.png" alt="" fill sizes="(max-width: 768px) 92vw, 550px" preload className="object-contain" />
      <div className="absolute left-[36%] top-[17%] h-[44%] w-[46%] origin-center rotate-[3deg] -skew-x-[9deg] overflow-hidden rounded-sm bg-stone-50 p-3 text-[clamp(6px,1vw,12px)] text-stone-800">
        <div className="border-b border-stone-200 pb-2 font-bold text-emerald-900">VotecastHub GH <span className="float-right font-normal">Your events</span></div>
        <p className="mt-3 font-semibold">Ghana Campus Awards</p><p className="mt-1 text-stone-500">Everything you need for your next event.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">{["Event details", "Nominees", "Voting rules"].map(label => <span key={label} className="rounded border border-emerald-100 bg-white p-2 text-emerald-900">{label}</span>)}</div>
        <div className="mt-3 rounded bg-emerald-900 p-2 text-white">Set up your categories and nominees →</div>
      </div>
      <div className="absolute left-[83%] top-[40%] h-[33%] w-[12%] -rotate-[6deg] overflow-hidden rounded-xl bg-stone-50 p-1.5 text-[clamp(5px,.8vw,9px)] text-stone-800">
        <p className="font-bold text-emerald-900">VotecastHub GH</p><p className="mt-3 font-semibold">Choose your nominee</p>
        {["Contestant A", "Contestant B"].map(name => <div key={name} className="mt-2 rounded border border-stone-200 bg-white p-1"><span className="block h-5 rounded bg-emerald-100" /><p className="mt-1">{name}</p><span className="mt-1 block rounded bg-emerald-900 p-1 text-center text-white">Vote</span></div>)}
      </div>
    </div>
    <figcaption className="text-center text-xs text-stone-500">An illustration of event setup and website voting</figcaption>
  </figure>;
}
