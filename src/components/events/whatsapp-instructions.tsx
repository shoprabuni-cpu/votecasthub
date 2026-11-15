import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/server";

const WA_NUMBER = "233592992566";
const WA_DISPLAY = "+233 59 299 2566";

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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(waUrl)}`;

  return (
    <section className="my-5 rounded-2xl border border-emerald-300 bg-linear-to-br from-emerald-50 via-white to-stone-50 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-950">
            <span>💬 Official WhatsApp Channel</span>
            <span className="bg-emerald-600 size-1.5 rounded-full" />
            <span className="font-semibold text-emerald-800">100% Free · No SMS needed</span>
          </div>
          <h3 className="font-serif text-lg font-bold text-stone-900">
            Prefer voting on WhatsApp?
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed max-w-xl">
            You can cast your ballot directly in WhatsApp without downloading an app or waiting for SMS codes. Simply message <strong className="text-emerald-950 font-bold">{WA_DISPLAY}</strong>.
          </p>
        </div>

        {/* Desktop QR Scan */}
        <div className="hidden md:flex flex-col items-center gap-1 bg-white p-2 rounded-xl border border-emerald-200 shadow-2xs">
          <img
            src={qrUrl}
            alt="Scan to vote on WhatsApp"
            width={72}
            height={72}
            className="rounded-lg"
          />
          <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Scan to Vote</span>
        </div>
      </div>

      <div className="mt-4 pt-3.5 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-stone-500">Quick Command:</span>
          <code className="rounded-lg bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 font-mono text-xs font-bold text-emerald-950 select-all">
            {waMessage}
          </code>
        </div>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <Icon name="phone" size={14} />
          <span>Open WhatsApp to Vote</span> ↗
        </a>
      </div>
    </section>
  );
}
