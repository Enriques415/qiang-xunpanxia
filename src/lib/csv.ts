const FORMULA = /^[=+\-@]/;

export function csvCell(value: string): string {
  const safe = FORMULA.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map((value) => csvCell(value ?? "")).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}
