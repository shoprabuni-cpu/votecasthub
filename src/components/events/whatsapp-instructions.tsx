import Image from "next/image";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qr";
import { YouTubeTutorialButton } from "@/components/media/youtube-tutorial";

const WA_NUMBER = "233592992566";
const WA_DISPLAY = "+233 59 299 2566";
const TG_BOT_USERNAME = "VotecastHubGH_bot";
const TG_BOT_DISPLAY = "@VotecastHubGH_bot";

export async function WhatsAppInstructions({
  eventId,
  eventSlug,
  votingMode = "free",
}: {
  eventId: string;
  eventSlug: string;
  votingMode?: "free" | "paid";
}) {
  const db = await createClient();
  const { data } = await db.rpc("get_public_ussd", { p_event_id: eventId });
  const eventCode = data?.[0]?.event_code ? String(data[0].event_code) : eventSlug;
  const isPaid = votingMode === "paid";

  const waMessage = `VOTE ${eventCode}`;
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;
  const tgUrl = `https://t.me/${TG_BOT_USERNAME}?start=event_${eventSlug}`;
  const qrUrl = await generateQrDataUrl(waUrl, { width: 160, margin: 1 });

  return (
    <section className="my-4 rounded-2xl border border-emerald-300/80 bg-linear-to-br from-emerald-50/70 via-white to-sky-50/40 p-4 sm:p-5 shadow-xs dark:border-emerald-900/50 dark:bg-linear-to-br dark:from-[#0e1712] dark:via-[#0a110d] dark:to-[#060b08] dark:text-stone-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span>WhatsApp &amp; Telegram Bot Voting</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
              100% Free · No App Download Needed
            </span>
          </div>
          <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900 dark:text-white">
            Prefer voting on WhatsApp or Telegram?
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed max-w-xl dark:text-stone-300">
            Cast your ballot directly in your favorite chat app with instant Mobile Money payments.
            Message WhatsApp at <strong className="text-emerald-950 font-bold dark:text-emerald-300">{WA_DISPLAY}</strong> or launch our Telegram bot <strong className="text-sky-950 font-bold dark:text-sky-300">{TG_BOT_DISPLAY}</strong>.
          </p>
        </div>

        {/* Desktop QR Scan */}
        <div className="hidden md:flex flex-col items-center gap-1 bg-white p-2 rounded-xl border border-emerald-200 shadow-2xs dark:border-[#223028] dark:bg-[#121914]">
          <img
            src={qrUrl}
            alt="Scan to vote on WhatsApp"
            width={64}
            height={64}
            className="rounded-lg"
          />
          <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider dark:text-stone-400">Scan for Bot</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-3 dark:border-[#1c2721]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Quick Command:</span>
          <code className="rounded-lg bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 font-mono text-xs font-bold text-emerald-950 select-all dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-300">
            {waMessage}
          </code>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <YouTubeTutorialButton
            platform="whatsapp"
            label="Video Guide"
            variant="secondary"
            size="sm"
          />

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Image
              src="/images/whatsapp-logo.jpg"
              alt=""
              width={14}
              height={14}
              className="rounded-full"
            />
            <span>Vote on WhatsApp</span> ↗
          </a>

          <a
            href={tgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-sky-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-800 shadow-xs transition-all active:scale-95 cursor-pointer dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            <Image
              src="/images/telegram-logo.jpg"
              alt=""
              width={14}
              height={14}
              className="rounded-full"
            />
            <span>Vote on Telegram</span> ↗
          </a>
        </div>
      </div>
    </section>
  );
}
