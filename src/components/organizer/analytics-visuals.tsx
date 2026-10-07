import type { OrganizerAnalytics } from "@/lib/analytics";

export function AnalyticsVisuals({ data, days }: { data: OrganizerAnalytics; days: number }) {
  const max = Math.max(1, ...data.trends.map(row => Number(row.total_votes)));
  return <section className="analytics-chart-card space-y-4">
    <div><h2 className="font-serif text-2xl text-[#173d32]">How voting is going</h2><p className="mt-2 text-sm text-slate-500">Votes counted each day · {days === 0 ? "whole event" : `last ${days} days`}</p></div>
    <div className="flex h-44 items-end gap-1 overflow-x-auto border-b border-slate-200 pb-2" role="img" aria-label="Daily voting activity. Open Daily vote totals for exact values.">
      {data.trends.map(row => <div key={row.day} className="min-w-1 flex-1 rounded-t bg-[#1e704d]" title={`${row.day}: ${Number(row.total_votes).toLocaleString()} votes`} style={{ height: `${Number(row.total_votes) / max * 100}%` }} />)}
    </div>
    <div className="flex justify-between text-xs text-slate-500"><span>{data.trends[0]?.day}</span><span>{data.trends.at(-1)?.day}</span></div>
    <details><summary className="cursor-pointer text-sm font-semibold text-[#173d32]">Daily vote totals</summary><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Daily counted votes</caption><thead><tr><th className="py-2">Date</th><th className="py-2">Votes</th></tr></thead><tbody>{data.trends.map(row => <tr className="border-t border-slate-100" key={row.day}><td className="py-2">{row.day}</td><td>{Number(row.total_votes).toLocaleString()}</td></tr>)}</tbody></table></div></details>
    <p className="text-xs text-slate-500">Days use UTC. Refunds adjust the original voting day. Visitors count browsers, so one person may appear more than once across devices.</p>
  </section>;
}
