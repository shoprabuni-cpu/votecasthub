"use client";
export function CsvExportButton({ organizationId }: { organizationId: string }) {
  async function download() { const response = await fetch(`/api/organizer/${organizationId}/exports/payments`); if (!response.ok) return; const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "votecasthub-payments.csv"; anchor.click(); URL.revokeObjectURL(url); }
  return <button className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 transition cursor-pointer dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200" type="button" onClick={download}>↓ Export payments</button>;
}
