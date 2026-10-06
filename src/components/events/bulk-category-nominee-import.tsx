"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { useActionState } from "react";
import { importEventCategoriesNomineesAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

type Row = { category: string; categoryDescription: string; nominee: string; publicCode: string; biography: string };
const emptyRow = (category = ""): Row => ({ category, categoryDescription: "", nominee: "", publicCode: "", biography: "" });

export function BulkCategoryNomineeImport({ eventId, backTo }: { eventId: string; backTo: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileError, setFileError] = useState("");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(importEventCategoriesNomineesAction, null);

  function downloadTemplate() {
    const sheet = XLSX.utils.json_to_sheet([{ category: "Best New Artist", categoryDescription: "Optional description", nominee: "Ama Mensah", publicCode: "BNA-01", biography: "Optional short profile" }]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Nominees"); XLSX.writeFile(book, "votecasthub-nominees-template.xlsx");
  }
  async function readFile(file: File) {
    setFileError("");
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const values = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const normalized = values.map((value) => {
        const get = (...keys: string[]) => String(keys.map((key) => value[key] ?? value[key.toLowerCase()] ?? "").find(Boolean) ?? "").trim();
        return { category: get("category", "Category"), categoryDescription: get("categoryDescription", "category_description", "Category description"), nominee: get("nominee", "Nominee", "name", "Name"), publicCode: get("publicCode", "public_code", "Public code"), biography: get("biography", "Biography") };
      }).filter((row) => row.category && row.nominee).slice(0, 1000);
      if (!normalized.length) throw new Error("No rows with both Category and Nominee were found.");
      setRows(normalized);
    } catch (error) { setRows([]); setFileError(error instanceof Error ? error.message : "This spreadsheet could not be read."); }
  }
  return <section className="bulk-import-panel" aria-labelledby="bulk-import-title">
    <div className="bulk-import-heading"><div><p className="eyebrow">SAVE TIME</p><h3 id="bulk-import-title">Import categories and nominees</h3><p>Use one row per nominee. Categories are created automatically and repeated category names are grouped together.</p></div><button type="button" className="text-link" onClick={downloadTemplate}>Download Excel template</button></div>
    <label className="file-dropzone"> <strong>Choose an Excel or CSV file</strong><span>.xlsx, .xls, or .csv · up to 1,000 rows</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /></label>
    <div className="bulk-import-format"><strong>Required columns</strong><code>category</code><code>nominee</code><span>Optional: categoryDescription, publicCode, biography</span></div>
    {fileError && <p className="form-message" role="alert">{fileError}</p>}
    {rows.length > 0 && <><div className="bulk-import-preview"><div className="section-title-row"><strong>Preview</strong><span>{rows.length} row{rows.length === 1 ? "" : "s"} · {new Set(rows.map((row) => row.category.toLowerCase())).size} categories</span></div><div className="table-scroll"><table><thead><tr><th>Category</th><th>Nominee</th><th>Public code</th><th>Biography</th></tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={`${row.category}-${row.nominee}-${index}`}><td>{row.category}</td><td>{row.nominee}</td><td>{row.publicCode || "—"}</td><td>{row.biography || "—"}</td></tr>)}</tbody></table></div>{rows.length > 8 && <small>Showing the first 8 rows. All {rows.length} valid rows will be imported.</small>}</div><form action={formAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="backTo" value={backTo} /><input type="hidden" name="rows" value={JSON.stringify(rows)} />{state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}<button className="secondary-button" type="submit" disabled={pending}>{pending ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}</button></form></>}
  </section>;
}
