import Link from "next/link";
import Image from "next/image";

const WA_NUMBER = "233592992566";
const WA_DISPLAY = "+233 59 299 2566";
const TG_BOT_USERNAME = "VotecastHubGH_bot";
const TG_BOT_DISPLAY = "@VotecastHubGH_bot";

export function MessagingBotsOverview() {
  return (
    <section
      id="chat-voting"
      aria-labelledby="chat-voting-title"
      className="relative overflow-hidden rounded-3xl border border-emerald-200/90 bg-linear-to-br from-emerald-50/70 via-white to-sky-50/50 p-6 sm:p-10 shadow-xs"
    >
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-950">
            <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
            OMNICHANNEL BOT VOTING
          </span>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
            Built for Ghana 🇬🇭
          </span>
        </div>

        <h2
          id="chat-voting-title"
          className="mt-4 text-3xl font-serif font-bold tracking-tight text-stone-950 sm:text-4xl"
        >
          Vote seamlessly on <span className="text-emerald-800">WhatsApp</span> &amp;{" "}
          <span className="text-sky-700">Telegram</span>
        </h2>
        <p className="mt-3 text-base leading-7 text-stone-600 max-w-2xl">
          Bring your competition directly to where your audience already spends their time. Voters can cast ballots, verify their identities, and pay with Mobile Money in seconds—no app downloads or website logins required.
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* WhatsApp Bot Card */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="size-12 shrink-0 rounded-2xl bg-green-50 p-1.5 border border-green-200 shadow-2xs">
                  <Image
                    src="/images/whatsapp-logo.jpg"
                    alt="WhatsApp"
                    width={40}
                    height={40}
                    className="rounded-xl object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-lg">WhatsApp Voting</h3>
                  <p className="text-xs font-semibold text-emerald-700">{WA_DISPLAY}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                Official Bot
              </span>
            </div>

            <ul className="mt-4 space-y-2.5 text-xs text-stone-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">✓</span>
                <span><strong>No App Install:</strong> Works immediately on any smartphone or web WhatsApp.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">✓</span>
                <span><strong>Fast Text Voting:</strong> Send <code>VOTE</code> or candidate codes directly in chat.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">✓</span>
                <span><strong>Native Verification:</strong> Phone number is verified securely at zero SMS cost.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">✓</span>
                <span><strong>1-Tap MoMo Checkout:</strong> Tap the secure Paystack checkout button to pay.</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] font-mono font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded">
              Command: VOTE
            </span>
            <a
              href={`https://wa.me/${WA_NUMBER}?text=VOTE`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-all active:scale-95"
            >
              <span>Message on WhatsApp</span> ↗
            </a>
          </div>
        </div>

        {/* Telegram Bot Card */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-sky-200 bg-white p-6 shadow-sm hover:border-sky-300 transition-all">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="size-12 shrink-0 rounded-2xl bg-sky-50 p-1.5 border border-sky-200 shadow-2xs">
                  <Image
                    src="/images/telegram-logo.jpg"
                    alt="Telegram"
                    width={40}
                    height={40}
                    className="rounded-xl object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-lg">Telegram Bot</h3>
                  <p className="text-xs font-semibold text-sky-700">{TG_BOT_DISPLAY}</p>
                </div>
              </div>
              <span className="rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[11px] font-bold text-sky-950">
                Official Bot
              </span>
            </div>

            <ul className="mt-4 space-y-2.5 text-xs text-stone-600 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-sky-700 font-bold">✓</span>
                <span><strong>Interactive Ballot:</strong> Clean inline tap buttons with contestant photos &amp; details.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-700 font-bold">✓</span>
                <span><strong>1-Tap Phone Verification:</strong> Uses native Telegram contact sharing (0 SMS credits).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-700 font-bold">✓</span>
                <span><strong>Vote Packages:</strong> Select 1, 5, 10, or custom votes with live currency conversion.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-700 font-bold">✓</span>
                <span><strong>Instant Digital Receipt:</strong> Bot pushes automated receipt with transaction ID.</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] font-mono font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded">
              Bot: @{TG_BOT_USERNAME}
            </span>
            <a
              href={`https://t.me/${TG_BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-800 shadow-xs transition-all active:scale-95"
            >
              <span>Launch Telegram Bot</span> ↗
            </a>
          </div>
        </div>
      </div>

      {/* Payment methods strip */}
      <div className="mt-8 rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Supported Ghanaian Payment Channels
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Instant automated vote confirmation across all bot and web channels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-stone-200 shadow-2xs">
              <Image
                src="/images/mtn-momo.jpg"
                alt="MTN Mobile Money"
                width={28}
                height={22}
                className="rounded object-contain"
              />
              <span className="text-xs font-bold text-stone-800">MTN MoMo</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-stone-200 shadow-2xs">
              <Image
                src="/images/telecel-cash.jpg"
                alt="Telecel Cash"
                width={36}
                height={22}
                className="rounded object-contain"
              />
              <span className="text-xs font-bold text-stone-800">Telecel Cash</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-stone-200 shadow-2xs">
              <Image
                src="/images/airtel-cash.jpg"
                alt="AirtelTigo / AT Money"
                width={22}
                height={22}
                className="rounded object-contain"
              />
              <span className="text-xs font-bold text-stone-800">AT Money</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 border border-stone-200 shadow-2xs text-xs font-bold text-stone-700">
              <span>💳 Cards</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
