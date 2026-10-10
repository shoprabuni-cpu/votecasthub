"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { useActionState } from "react";
import { importEventCategoriesNomineesAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

type Row = { category: string; categoryDescription: string; nominee: string; publicCode: string; biography: string };

export function BulkCategoryNomineeImport({ eventId, backTo }: { eventId: string; backTo: string }) {
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [showMessage, setShowMessage] = useState(true);
  const [fileError, setFileError] = useState("");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(async (previous, data) => { const result = await importEventCategoriesNomineesAction(previous, data); setShowMessage(true); return result; }, null);

  function downloadTemplate() {
    const sheet = XLSX.utils.json_to_sheet([{ category: "Best New Artist", categoryDescription: "Optional description", nominee: "Ama Mensah", publicCode: "BNA-01", biography: "Optional short profile" }]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Nominees"); XLSX.writeFile(book, "votecasthub-nominees-template.xlsx");
  }
  async function readFile(file: File) {
    setFileError(""); setShowMessage(false); setReading(true); setRows([]);
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const values = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (values.length > 1000) throw new Error("This file has more than 1,000 rows. Split it into smaller files; nothing has been imported.");
      const normalized = values.map((value) => {
        const get = (...keys: string[]) => String(keys.map((key) => value[key] ?? value[key.toLowerCase()] ?? "").find(Boolean) ?? "").trim();
        return { category: get("category", "Category"), categoryDescription: get("categoryDescription", "category_description", "Category description"), nominee: get("nominee", "Nominee", "name", "Name"), publicCode: get("publicCode", "public_code", "Public code"), biography: get("biography", "Biography") };
      });
      const invalid = normalized.findIndex(row => !row.category || !row.nominee || row.category.length > 120 || row.nominee.length > 160 || row.publicCode.length > 32 || !/^[A-Za-z0-9-]*$/.test(row.publicCode) || row.biography.length > 3000 || row.categoryDescription.length > 2000);
      if (invalid >= 0) throw new Error(`Spreadsheet row ${invalid + 2} has missing or invalid details. Correct it before importing.`);
      if (!normalized.length) throw new Error("No rows with both Category and Nominee were found.");
      setRows(normalized);
    } catch (error) { setRows([]); setFileError(error instanceof Error ? error.message : "This spreadsheet could not be read."); } finally { setReading(false); }
  }
  return <section className="space-y-5" aria-labelledby="bulk-import-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">SAVE TIME</p><h3 id="bulk-import-title" className="mt-1 text-lg font-semibold text-stone-900">Import categories and nominees</h3><p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Use one row per nominee. Categories are created automatically and repeated category names are grouped together.</p></div><button type="button" className="min-h-11 text-sm font-semibold text-emerald-800 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={downloadTemplate}>Download Excel template</button></div>
    <label className="flex flex-col gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-5 text-sm"> <strong>Choose an Excel or CSV file</strong><span>.xlsx, .xls, or .csv · up to 1,000 rows</span><input type="file" accept=".xlsx,.xls,.csv" disabled={pending || reading} onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /></label>
    <div className="flex flex-wrap gap-2 text-sm text-stone-600"><strong>Required columns</strong><code>category</code><code>nominee</code><span>Optional: categoryDescription, publicCode, biography</span></div>
    {reading && <p role="status" className="text-sm text-stone-600">Checking your spreadsheet…</p>}
    {fileError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{fileError}</p>}
    {rows.length > 0 && <><div className="space-y-3 rounded-xl border border-stone-200 p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>Preview</strong><span>{rows.length} row{rows.length === 1 ? "" : "s"} · {new Set(rows.map((row) => row.category.toLowerCase())).size} categories</span></div><div className="overflow-x-auto [&_td]:p-3 [&_th]:p-3 [&_th]:text-left [&_table]:w-full [&_table]:text-sm"><table><thead><tr><th>Category</th><th>Nominee</th><th>Public code</th><th>Biography</th></tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={`${row.category}-${row.nominee}-${index}`}><td>{row.category}</td><td>{row.nominee}</td><td>{row.publicCode || "—"}</td><td>{row.biography || "—"}</td></tr>)}</tbody></table></div>{rows.length > 8 && <small>Showing the first 8 rows. All {rows.length} valid rows will be imported.</small>}</div><form action={formAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="backTo" value={backTo} /><input type="hidden" name="rows" value={JSON.stringify(rows)} />{showMessage && state?.message && <p className={state.success ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-xl bg-red-50 p-3 text-sm text-red-800"} role={state.success ? "status" : "alert"}>{state.message}</p>}<button className="mt-3 min-h-11 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed" type="submit" disabled={pending || Boolean(state?.success && showMessage)}>{pending ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}</button></form></>}
  </section>;
}
