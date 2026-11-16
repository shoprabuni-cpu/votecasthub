"use client";

import { useRouter } from "next/navigation";
import type { AnalyticsEventChoice } from "@/components/organizer/event-analytics-picker";

export function EventSwitcher({
  choices,
  activeId,
  days,
}: {
  choices: AnalyticsEventChoice[];
  activeId: string;
  days: number;
}) {
  const router = useRouter();

  if (choices.length <= 1) return null;

  return (
    <div className="relative">
      <select
        defaultValue={activeId}
        onChange={(e) => {
          const newId = e.target.value;
          const rangeParam = days === 0 ? "all" : String(days);
          router.push(`?event=${encodeURIComponent(newId)}&range=${rangeParam}`);
        }}
        aria-label="Switch active event"
        className="rounded-xl border border-white/20 bg-emerald-900/90 text-white pl-3 pr-8 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer shadow-xs"
      >
        {choices.map((c) => (
          <option key={c.id} value={c.id} className="bg-stone-900 text-white">
            {c.name} ({c.status.replace("_", " ")})
          </option>
        ))}
      </select>
    </div>
  );
}
