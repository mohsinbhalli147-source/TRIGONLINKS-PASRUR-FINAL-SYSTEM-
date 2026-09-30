/**
 * CSV export helpers.
 *
 * A cell whose first character is =, +, -, @, tab or carriage return is executed
 * as a formula by Excel and LibreOffice when the file is opened. Since these
 * exports contain operator-entered subscriber names and addresses, a value like
 * `=HYPERLINK("http://evil","click")` would run in the recipient's spreadsheet.
 * Every cell is therefore prefixed with a tab, which spreadsheets treat as text.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = typeof value === 'string' ? value : String(value);
  if (text.length > 0 && FORMULA_TRIGGERS.includes(text[0])) {
    text = `\t${text}`;
  }
  // Quotes must be doubled, and the whole cell wrapped, or an embedded quote or
  // newline corrupts the row.
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(toCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(toCsvCell).join(','));
  }
  // A BOM makes Excel read the file as UTF-8, so non-ASCII names survive.
  return `\uFEFF${lines.join('\r\n')}`;
}

/** Triggers a browser download without leaking the object URL. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
