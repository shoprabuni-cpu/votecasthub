import Link from "next/link";
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
  const configured = Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_BUSINESS_TOKEN
  );
  if (!configured) return null;

  const db = await createClient();
  const { data } = await db.rpc("get_public_ussd", { p_event_id: eventId });
  const eventCode = data?.[0]?.event_code ? String(data[0].event_code) : eventSlug;
  const isPaid = votingMode === "paid";

  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`VOTE ${eventCode} `)}`;

  return (
    <section className="my-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex items-center gap-2 text-emerald-900">
        <Icon name="phone" />
        <h2 className="text-lg font-semibold">Vote via WhatsApp</h2>
      </div>

      <p className="mt-3 text-sm text-stone-700">
        Send a WhatsApp message to <strong className="text-emerald-950">{WA_DISPLAY}</strong>:
      </p>

      <div className="mt-2 rounded-xl bg-white border border-emerald-200 p-3 font-mono text-sm font-semibold text-emerald-950">
        VOTE {eventCode} &lt;NOMINEE_CODE&gt;{isPaid ? " [QUANTITY]" : ""}
      </div>

      <p className="mt-2 text-xs text-stone-600">
        {isPaid
          ? "You will receive a Paystack Mobile Money link on WhatsApp to complete payment and cast your vote."
          : "Your free vote will be counted instantly with an immediate WhatsApp receipt."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <Icon name="phone" size={16} />
          Vote on WhatsApp
        </a>
      </div>
    </section>
  );
}

