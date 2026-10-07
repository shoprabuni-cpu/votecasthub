import Link from "next/link";

export function AnalyticsRange({ days, event }: { days: number; event: string | null }) {
  const options = [
    { label: "Whole Event", val: "all", num: 0 },
    { label: "Past 7 Days", val: "7", num: 7 },
    { label: "Past 30 Days", val: "30", num: 30 },
    { label: "Past 365 Days", val: "365", num: 365 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-stone-500 mr-1">Time Scope:</span>
      <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-100 p-1">
        {options.map((opt) => {
          const isActive = days === opt.num;
          return (
            <Link
              key={opt.val}
              href={`?event=${encodeURIComponent(event ?? "")}&range=${opt.val}`}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
