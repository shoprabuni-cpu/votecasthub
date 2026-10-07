"use client";

import { categoryStandings, csvValue, type NomineeAnalytics } from "@/lib/analytics";
import { Icon } from "@/components/icon";

export function ResultsExportActions({
  nominees,
  scopeLabel,
}: {
  nominees: NomineeAnalytics[];
  scopeLabel: string;
}) {
  const ranked = categoryStandings(nominees);

  function downloadCsv() {
    const lines = [
      ["Period", "Category rank", "Nominee", "Category", "Event", "Valid votes"],
      ...ranked.map((row) => [
        scopeLabel,
        Number(row.total_votes) > 0 ? row.rank : "",
        row.nominee_name,
        row.category_name,
        row.event_name,
        row.total_votes,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.map((row) => row.map(csvValue).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "votecasthub-category-standings.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 180 + Math.min(12, ranked.length) * 80;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fafbf8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#173d32";
    context.font = "bold 32px Arial";
    context.fillText("VoteHub · Category Standings Summary", 50, 55);
    context.font = "18px Arial";
    context.fillText(scopeLabel.slice(0, 100), 50, 90);
    context.fillText(
      `Showing ${Math.min(12, ranked.length)} of ${ranked.length} nominees. Official certified record.`,
      50,
      120
    );
    ranked.slice(0, 12).forEach((row, index) => {
      const y = 175 + index * 80;
      context.font = "bold 22px Arial";
      context.fillText(
        `${Number(row.total_votes) > 0 ? `#${row.rank}` : "—"} · ${row.nominee_name.slice(0, 52)}`,
        50,
        y
      );
      context.font = "18px Arial";
      context.fillText(
        `${row.category_name.slice(0, 60)} · ${Number(row.total_votes).toLocaleString()} valid votes`,
        50,
        y + 28
      );
    });
    const link = document.createElement("a");
    link.download = "votecasthub-category-standings.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5" aria-label="Export results">
      <button
        type="button"
        disabled={!ranked.length}
        onClick={downloadCsv}
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 disabled:opacity-50 transition-all cursor-pointer"
      >
        <span>Download Full CSV</span>
      </button>

      <button
        type="button"
        disabled={!ranked.length}
        onClick={downloadImage}
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 disabled:opacity-50 transition-all cursor-pointer"
      >
        <Icon name="image" size={13} />
        <span>Save Summary Graphic</span>
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all cursor-pointer"
      >
        <span>Print / Save PDF</span>
      </button>
    </div>
  );
}
