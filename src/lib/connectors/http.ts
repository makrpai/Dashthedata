/** Turns a Google Sheets edit link into a CSV export URL. Other URLs pass through. */
export function normalizeHttpSource(raw: string): { url: string; googleSheets: boolean } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, googleSheets: false };
  }
  const match = url.hostname === 'docs.google.com' && url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) return { url: raw, googleSheets: false };
  return {
    url: `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`,
    googleSheets: true,
  };
}

export function rowsFromJson(value: unknown): { headers: string[]; rows: string[][] } {
  const records = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data) ? (value as { data: unknown[] }).data : null;
  if (!records || !records.length || typeof records[0] !== 'object' || records[0] === null) {
    throw new Error('The response is not a list of records');
  }
  const headers = [...new Set(records.flatMap((row) => Object.keys(row as object)))];
  const rows = records.slice(0, 5000).map((row) => headers.map((key) => {
    const cell = (row as Record<string, unknown>)[key];
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'object') return JSON.stringify(cell);
    return String(cell);
  }));
  return { headers, rows };
}
