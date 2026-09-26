import { sqlLiteral } from '@/lib/duckdb/sql';
import type { TimeGrain } from '@/types/domain';
import { guessMonthLocale, monthCaseSql, monthFromName } from './months';

/**
 * Date formats (8.3), parsed with regular expressions (never Date.parse). Each format lists its
 * regex and which capture groups hold year, month, day and time; the SQL cast is generated from
 * the same definition.
 */
export type DateFormatId =
  | 'iso'
  | 'isoMonth'
  | 'dotted'
  | 'dmy'
  | 'mdy'
  | 'monthName:fi'
  | 'monthName:en'
  | 'quarterQY'
  | 'quarterYQ'
  | 'quarterFi'
  | 'excelSerial';

interface DateFormatDef {
  id: Exclude<DateFormatId, 'excelSerial'>;
  pattern: string;
  y: number;
  m?: number;
  /** Group with a month name. */
  monthName?: number;
  /** Group with a quarter number (1–4). */
  quarter?: number;
  d?: number;
  h?: number;
  mi?: number;
  s?: number;
  grain?: TimeGrain;
}

const TIME = '(?:[T ]+(?:klo\\s+)?(\\d{1,2})[.:](\\d{2})(?:[.:](\\d{2}))?(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?)?';

export const DATE_FORMATS: DateFormatDef[] = [
  { id: 'iso', pattern: `^(\\d{4})-(\\d{1,2})-(\\d{1,2})${TIME}$`, y: 1, m: 2, d: 3, h: 4, mi: 5, s: 6 },
  { id: 'isoMonth', pattern: '^(\\d{4})-(\\d{1,2})$', y: 1, m: 2, grain: 'month' },
  { id: 'dotted', pattern: `^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4}|\\d{2})${TIME}$`, d: 1, m: 2, y: 3, h: 4, mi: 5, s: 6 },
  { id: 'dmy', pattern: `^(\\d{1,2})/(\\d{1,2})/(\\d{4}|\\d{2})${TIME}$`, d: 1, m: 2, y: 3, h: 4, mi: 5, s: 6 },
  { id: 'mdy', pattern: `^(\\d{1,2})/(\\d{1,2})/(\\d{4}|\\d{2})${TIME}$`, m: 1, d: 2, y: 3, h: 4, mi: 5, s: 6 },
  { id: 'monthName:fi', pattern: '^([a-zäöå]+)\\.?\\s+(\\d{4})$', monthName: 1, y: 2, grain: 'month' },
  { id: 'monthName:en', pattern: '^([a-zäöå]+)\\.?\\s+(\\d{4})$', monthName: 1, y: 2, grain: 'month' },
  { id: 'quarterQY', pattern: '^q([1-4])\\s*[/ -]?\\s*(\\d{4})$', quarter: 1, y: 2, grain: 'quarter' },
  { id: 'quarterYQ', pattern: '^(\\d{4})\\s*[/ -]?\\s*q([1-4])$', y: 1, quarter: 2, grain: 'quarter' },
  {
    id: 'quarterFi',
    pattern: '^([1-4])\\.?\\s*(?:neljännes|nelj\\.?|kvartaali|q)\\s*(\\d{4})$',
    quarter: 1,
    y: 2,
    grain: 'quarter',
  },
];

const defs = new Map(DATE_FORMATS.map((d) => [d.id, d]));
const compiled = new Map(DATE_FORMATS.map((d) => [d.id, new RegExp(d.pattern, 'i')]));

/** Excel serial numbers are dates only when the header looks like a date column (8.3). */
export const DATE_HEADER_RE = /pvm|päivä|päiväys|aika|date|day|time/i;

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

function fullYear(y: string): number {
  const n = Number(y);
  if (y.length === 2) return n < 50 ? 2000 + n : 1900 + n;
  return n;
}

function valid(y: number, m: number, d: number, h = 0, mi = 0, s = 0): boolean {
  if (m < 1 || m > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
}

export interface ParsedDate {
  /** YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss */
  iso: string;
  hasTime: boolean;
  /** For ambiguity checks of slash dates. */
  parts?: [number, number];
}

export function parseDateWith(value: string, id: DateFormatId): ParsedDate | null {
  const v = value.trim();
  if (id === 'excelSerial') {
    if (!/^\d+(\.\d+)?$/.test(v)) return null;
    const n = Number(v);
    if (n < 20000 || n > 80000) return null;
    const ms = Date.UTC(1899, 11, 30) + Math.round(n * 86400) * 1000;
    const dt = new Date(ms);
    const date = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    const hasTime = dt.getUTCHours() + dt.getUTCMinutes() + dt.getUTCSeconds() > 0;
    return {
      iso: hasTime ? `${date}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}` : date,
      hasTime,
    };
  }
  const def = defs.get(id);
  const m = def && v.match(compiled.get(id)!);
  if (!def || !m) return null;
  const y = fullYear(m[def.y]);
  let month = 1;
  if (def.m) month = Number(m[def.m]);
  else if (def.monthName) {
    const n = monthFromName(m[def.monthName], id === 'monthName:fi' ? 'fi' : 'en');
    if (!n) return null;
    month = n;
  } else if (def.quarter) month = (Number(m[def.quarter]) - 1) * 3 + 1;
  const d = def.d ? Number(m[def.d]) : 1;
  const h = def.h && m[def.h] ? Number(m[def.h]) : 0;
  const mi = def.mi && m[def.mi] ? Number(m[def.mi]) : 0;
  const s = def.s && m[def.s] ? Number(m[def.s]) : 0;
  if (!valid(y, month, d, h, mi, s)) return null;
  const date = `${pad(y, 4)}-${pad(month)}-${pad(d)}`;
  const hasTime = h + mi + s > 0;
  return {
    iso: hasTime ? `${date}T${pad(h)}:${pad(mi)}:${pad(s)}` : date,
    hasTime,
    parts: id === 'dmy' || id === 'mdy' ? [Number(m[1]), Number(m[2])] : undefined,
  };
}

export interface DateDecision {
  formats: DateFormatId[];
  /** Share of values parsed by the chosen formats. */
  ratio: number;
  hasTimeRatio: number;
  ambiguous: boolean;
  grain?: TimeGrain;
}

/**
 * Picks the date formats that parse a column (8.3). Slash dates: a first part > 12 means D/M, a
 * second part > 12 means M/D, otherwise the data locale decides and the column is flagged.
 */
export function decideDateFormats(values: string[], header: string, dataLocale: 'fi' | 'en'): DateDecision | null {
  const trimmed = values.map((v) => v.trim()).filter(Boolean);
  if (!trimmed.length) return null;
  const monthLocale = guessMonthLocale(
    trimmed.map((v) => v.split(/\s+/)[0]),
    dataLocale,
  );
  let slash: 'dmy' | 'mdy' | null = null;
  let ambiguous = false;
  const slashValues = trimmed.filter((v) => compiled.get('dmy')!.test(v));
  if (slashValues.length) {
    const firstBig = slashValues.some((v) => Number(v.split('/')[0]) > 12);
    const secondBig = slashValues.some((v) => Number(v.split('/')[1]) > 12);
    if (firstBig && !secondBig) slash = 'dmy';
    else if (secondBig && !firstBig) slash = 'mdy';
    else {
      slash = dataLocale === 'fi' ? 'dmy' : 'mdy';
      ambiguous = !firstBig && !secondBig;
    }
  }
  const candidates: DateFormatId[] = [
    'iso',
    'isoMonth',
    'dotted',
    ...(slash ? [slash] : []),
    monthLocale === 'fi' ? 'monthName:fi' : 'monthName:en',
    'quarterQY',
    'quarterYQ',
    'quarterFi',
  ];
  if (DATE_HEADER_RE.test(header)) candidates.push('excelSerial');

  const parsedBy = new Map<DateFormatId, ParsedDate[]>();
  const covered = new Set<number>();
  const chosen: DateFormatId[] = [];
  let withTime = 0;
  const counts = candidates
    .map((id) => {
      const hits: number[] = [];
      trimmed.forEach((v, i) => {
        const p = parseDateWith(v, id);
        if (p) {
          hits.push(i);
          parsedBy.set(id, [...(parsedBy.get(id) ?? []), p]);
        }
      });
      return { id, hits };
    })
    .filter((c) => c.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length);
  for (const c of counts) {
    const fresh = c.hits.filter((i) => !covered.has(i));
    if (!fresh.length) continue;
    // Ignore formats that only explain a sliver of the column (noise).
    if (chosen.length > 0 && fresh.length < trimmed.length * 0.02) continue;
    chosen.push(c.id);
    for (const i of fresh) {
      covered.add(i);
      if (parseDateWith(trimmed[i], c.id)?.hasTime) withTime++;
    }
  }
  if (!chosen.length) return null;
  const grains = chosen.map((id) => (id === 'excelSerial' ? undefined : defs.get(id)?.grain));
  const grain = grains.every((g) => g === 'month') ? 'month' : grains.every((g) => g === 'quarter') ? 'quarter' : undefined;
  return { formats: chosen, ratio: covered.size / trimmed.length, hasTimeRatio: withTime / Math.max(1, covered.size), ambiguous, grain };
}

/** Parses with the first matching format of a decision. */
export function parseDateValue(value: string, formats: DateFormatId[]): ParsedDate | null {
  for (const f of formats) {
    const p = parseDateWith(value, f);
    if (p) return p;
  }
  return null;
}

/** SQL for one format: builds 'YYYY-M-D H:MI:S' from regex groups and TRY_CASTs it (NULL on failure). */
function formatSql(x: string, id: DateFormatId): string {
  if (id === 'excelSerial') {
    return (
      `(CASE WHEN regexp_matches(${x}, '^\\d+(\\.\\d+)?$') AND TRY_CAST(${x} AS DOUBLE) BETWEEN 20000 AND 80000 ` +
      `THEN TIMESTAMP '1899-12-30 00:00:00' + to_seconds(CAST(round(TRY_CAST(${x} AS DOUBLE) * 86400) AS BIGINT)) END)`
    );
  }
  const def = defs.get(id)!;
  const p = sqlLiteral(def.pattern);
  const g = (i: number) => `regexp_extract(${x}, ${p}, ${i}, 'i')`;
  const orZero = (i?: number) => (i ? `coalesce(nullif(${g(i)}, ''), '0')` : `'0'`);
  const yearRaw = g(def.y);
  const year = `(CASE WHEN length(${yearRaw}) = 2 THEN CAST(CAST(${yearRaw} AS INTEGER) + CASE WHEN CAST(${yearRaw} AS INTEGER) < 50 THEN 2000 ELSE 1900 END AS VARCHAR) ELSE ${yearRaw} END)`;
  let month: string;
  if (def.m) month = g(def.m);
  else if (def.monthName) month = `CAST(${monthCaseSql(`lower(${g(def.monthName)})`, id === 'monthName:fi' ? 'fi' : 'en')} AS VARCHAR)`;
  else month = `CAST((CAST(${g(def.quarter!)} AS INTEGER) - 1) * 3 + 1 AS VARCHAR)`;
  const day = def.d ? g(def.d) : `'1'`;
  const text = `${year} || '-' || ${month} || '-' || ${day} || ' ' || ${orZero(def.h)} || ':' || ${orZero(def.mi)} || ':' || ${orZero(def.s)}`;
  return `(CASE WHEN regexp_matches(${x}, ${p}, 'i') THEN TRY_CAST(${text} AS TIMESTAMP) END)`;
}

/** SQL converting a VARCHAR expression to DATE or TIMESTAMP using the chosen formats. */
export function dateCastSql(expr: string, formats: DateFormatId[], to: 'date' | 'datetime'): string {
  const x = `trim(${expr})`;
  const parts = formats.map((f) => formatSql(x, f));
  const ts = parts.length === 1 ? parts[0] : `coalesce(${parts.join(', ')})`;
  return to === 'date' ? `CAST(${ts} AS DATE)` : ts;
}
