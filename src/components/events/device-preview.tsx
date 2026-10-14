import Image from "next/image";

export function DevicePreview({ phone = false }: { phone?: boolean }) {
  return <figure className={phone ? "mx-auto w-full max-w-[200px]" : "w-full"}>
    <div aria-hidden="true" className={`relative ${phone ? "aspect-[1094/1440]" : "aspect-[1684/938]"} motion-safe:transition-transform motion-safe:duration-500 motion-safe:hover:-translate-y-1`}>
      <Image
        src={phone ? "/images/Classic Charcoal Feature Phone Cutout.png" : "/images/VotecastHub GH Voting Mockup.png"}
        alt=""
        fill
        sizes={phone ? "200px" : "(max-width: 768px) 92vw, 550px"}
        preload={!phone}
        className="object-contain"
      />
    </div>
    <figcaption className="mt-3 text-center text-xs text-stone-500">{phone ? "Example voting menu" : "An illustration of event setup and website voting"}</figcaption>
  </figure>;
}
