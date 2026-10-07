const reports = [
  ["votes", "Votes", "Recorded and valid votes after refunds"],
  ["nominees", "Nominees", "Nominee vote totals in this scope"],
  ["refunds", "Refunds", "Refunds on payments in this scope"],
  ["payments", "Payments", "Confirmed collections, refunds and net"],
  ["sms", "SMS credits", "Organization credit activity in this period"],
] as const;
export function ExportCenter({ organizationId, scopeQuery }: { organizationId: string; scopeQuery: string }) {
  const days = new URLSearchParams(scopeQuery).get("range") ?? "30";
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">Export center</h2><p className="mt-2 text-sm text-slate-500">Reports use the selected event and date range. SMS credits apply to the whole organization.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{reports.map(([kind, label, description]) => <a className="rounded-xl border border-slate-200 p-4 hover:bg-green-50" key={kind} href={`/api/organizer/${organizationId}/exports/${kind}?${kind === "sms" ? `range=${days}` : scopeQuery}`}><strong>{label} ↓</strong><p className="mt-1 text-sm text-slate-500">{description}</p></a>)}</div></section>;
}
