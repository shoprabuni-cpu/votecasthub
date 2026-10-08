/** Parse one-column CSV/TXT or a CSV with a named identifier column. */
export function parseVoterRoster(text: string): string[] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === ";" || c === "\n" || c === "\r")) {
      row.push(value.trim()); value = "";
      if (c === "\n" || c === "\r") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === "\r" && source[i + 1] === "\n") i++;
      }
    } else value += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote. Check the file and try again.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = ["identifier", "email", "phone", "index_number", "index number", "student_id", "student id", "membership_id", "label"];
  const column = rows[0]?.findIndex((cell) => headers.includes(cell.toLowerCase())) ?? -1;
  const values = column >= 0 ? rows.slice(1).map((cells) => cells[column] ?? "") : rows.flat();
  const identifiers = [...new Set(values.filter(Boolean))];
  if (identifiers.length > 5000) throw new Error("Import up to 5,000 voters at a time.");
  if (identifiers.some((v) => v.length > 320)) throw new Error("Each voter identifier must be at most 320 characters.");
  return identifiers;
}
