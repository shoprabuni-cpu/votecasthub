"use client";
export function CsvExportButton({ organizationId }: { organizationId: string }) {
  async function download() { const response = await fetch(`/api/organizer/${organizationId}/exports/payments`); if (!response.ok) return; const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "votecasthub-payments.csv"; anchor.click(); URL.revokeObjectURL(url); }
  return <button className="button button-secondary" type="button" onClick={download}>↓ Export payments</button>;
}
