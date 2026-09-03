/**
 * Minimal CSV reader and writer. Handles quoted fields, embedded commas and doubled quotes,
 * which is everything the rater sheet and the edit log need. A CSV library would be a
 * dependency the frozen stack does not justify (08 §B).
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n") + "\n";
}
