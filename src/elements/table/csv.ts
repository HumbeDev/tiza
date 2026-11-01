/**
 * Parses CSV/TSV text (RFC 4180 quoting). The delimiter is detected from the first line:
 * comma, semicolon (Excel in Spanish/Portuguese/French locales) or tab.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop trailing empty lines.
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const c of firstLine) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c in counts) counts[c as keyof typeof counts]++;
  }
  const best = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

/** Numbers (with thousands separators, decimals, sign, %) are right-aligned like Excel. */
export const isNumeric = (value: string): boolean =>
  /^[-+−]?(\d{1,3}([.,\s]\d{3})+|\d+)([.,]\d+)?\s*%?$/.test(value.trim());
