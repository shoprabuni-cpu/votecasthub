import { Icon } from "@/components/icon";

export function TrustSection() {
  const pillars = [
    {
      badge: "GHANA TELECOMS",
      title: "All Major Networks",
      description: "MTN Mobile Money, Telecel Cash, and AT Money prompt smoothly on smartphones and feature phones.",
      icon: "phone" as const,
    },
    {
      badge: "FRAUD DEFENSE",
      title: "Real Phone Verification",
      description: "Free categories enforce 1-vote-per-number via SMS OTP. Zero room for automated vote-stuffing bots.",
      icon: "shield" as const,
    },
    {
      badge: "AUDIT LEDGER",
      title: "Signed Audit Logs",
      description: "Every vote transaction is stored with timestamp and transaction hash for post-event auditing.",
      icon: "lock" as const,
    },
    {
      badge: "PAYMENTS COMPLIANCE",
      title: "Fast Next-Day Payouts",
      description: "Event proceeds are secured through certified Paystack gateways with transparent fee deductions.",
      icon: "wallet" as const,
    },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Ghana Mobile Money Network strip */}
        <div className="rounded-2xl bg-emerald-950 text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md mb-16">
          <div className="flex items-center gap-4 text-center md:text-left">
            <span className="w-12 h-12 rounded-xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center text-xl shrink-0">
              🇬🇭
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                PROUDLY BUILT FOR THE GHANAIAN ECOSYSTEM
              </p>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Works seamlessly with Ghanaian Mobile Money & Debit Cards
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-semibold">
            <span className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-amber-950 font-bold shadow-xs">
              MTN MoMo
            </span>
            <span className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white font-bold shadow-xs">
              Telecel Cash
            </span>
            <span className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold shadow-xs">
              AT Money
            </span>
            <span className="px-3.5 py-1.5 rounded-lg bg-emerald-800 text-emerald-100 font-semibold border border-emerald-700/60">
              Visa / Mastercard
            </span>
          </div>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-emerald-800 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
                <Icon name={item.icon} size={20} />
              </div>
              <span className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase block mb-1">
                {item.badge}
              </span>
              <h4 className="text-base font-bold text-slate-900 mb-2">{item.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
