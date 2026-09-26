const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** Excel serial day number → ISO date / datetime (1900 system, or 1904 when flagged). */
export function excelSerialToIso(serial: number, date1904 = false): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const ms = Math.round((serial * 86400000) / 1000) * 1000;
  const d = new Date(epoch + ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  return h || m || s ? `${date}T${pad(h)}:${pad(m)}:${pad(s)}` : date;
}

/** JS Date (local components, as created by parsers) → ISO. */
export function dateToIso(d: Date): string {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  return h || m || s ? `${date}T${pad(h)}:${pad(m)}:${pad(s)}` : date;
}

/**
 * Canonical string form used for every raw cell (7.2): numbers with a dot and no grouping,
 * booleans as true/false, dates as ISO. Empty strings become null.
 */
export function toCanonicalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : dateToIso(value);
  return JSON.stringify(value);
}

/** Pads rows to the same width. */
export function rectangular(rows: Array<Array<string | null>>): { width: number; rows: Array<Array<string | null>> } {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  return {
    width,
    rows: rows.map((r) => (r.length === width ? r : [...r, ...new Array<null>(width - r.length).fill(null)])),
  };
}

export const rawColumnNames = (width: number) => Array.from({ length: width }, (_, i) => `c${i}`);
