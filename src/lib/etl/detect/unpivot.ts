import { parseDateWith } from '@/lib/profile/dateFormat';
import { guessMonthLocale, monthFromName } from '@/lib/profile/months';
import type { Localized } from '@/types/domain';
import type { DetectContext, Proposal } from '../types';
import { fetchRows, isEmpty, toNumber } from './common';

export type PeriodHeader =
  | { type: 'month'; month: number; year?: number; token?: string }
  | { type: 'quarter'; quarter: number; year?: number }
  | { type: 'year'; year: number }
  | { type: 'date'; iso: string };

/** Parses a column header as a period (9.4.4). */
export function parsePeriodHeader(raw: string, monthLocale: 'fi' | 'en'): PeriodHeader | null {
  const s = raw.trim();
  let m = s.match(/^(19\d{2}|20\d{2})$/);
  if (m) return { type: 'year', year: Number(m[1]) };
  m = s.match(/^q([1-4])(?:\s*[/ -]?\s*(\d{4}))?$/i);
  if (m) return { type: 'quarter', quarter: Number(m[1]), year: m[2] ? Number(m[2]) : undefined };
  m = s.match(/^(\d{4})\s*[/ -]?\s*q([1-4])$/i);
  if (m) return { type: 'quarter', quarter: Number(m[2]), year: Number(m[1]) };
  m = s.match(/^([1-4])\.\s*(?:nelj\.?|neljännes|kvartaali)(?:\s+(\d{4}))?$/i);
  if (m) return { type: 'quarter', quarter: Number(m[1]), year: m[2] ? Number(m[2]) : undefined };
  m = s.match(/^([a-zäöå]+)\.?(?:\s+(\d{4}))?$/i);
  if (m) {
    const month = monthFromName(m[1], monthLocale);
    if (month) return { type: 'month', month, year: m[2] ? Number(m[2]) : undefined, token: m[1] };
  }
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return { type: 'month', month: Number(m[1]), year: Number(m[2]) };
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { type: 'month', month: Number(m[2]), year: Number(m[1]) };
  const d = parseDateWith(s, 'iso') ?? parseDateWith(s, 'dotted');
  if (d && !d.hasTime) return { type: 'date', iso: d.iso };
  return null;
}

const firstYear = (texts: Array<string | undefined>): number | undefined => {
  for (const t of texts) {
    const m = t?.match(/\b(20\d{2}|19\d{2})\b/);
    if (m) return Number(m[1]);
  }
  return undefined;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Value column name from the sheet/dataset name ("Myynti 2025" → "Myynti"), default Arvo/Value. */
export function valueNameFrom(datasetName: string): Localized {
  if (/\b(19|20)\d{2}\b/.test(datasetName)) {
    const base = datasetName.replace(/\b(19|20)\d{2}\b/g, '').replace(/[-–_/]+/g, ' ').trim();
    if (base && base.length <= 40) return { fi: base, en: base };
  }
  return { fi: 'Arvo', en: 'Value' };
}

/** 7. Wide table with ≥ 3 consecutive period columns holding numbers → unpivot. */
export async function detectUnpivot(ctx: DetectContext): Promise<Proposal[]> {
  const cols = ctx.columns;
  if (cols.length < 3) return [];
  const monthLocale = guessMonthLocale(cols.map((c) => c.displayName.split(/\s+/)[0]), ctx.dataLocale);
  const headers = cols.map((c) => parsePeriodHeader(c.displayName, monthLocale));
  const { rows } = await fetchRows(ctx, 200);
  const numericShare = (i: number) => {
    const vals = rows.map((r) => r[i]).filter((v): v is string => !isEmpty(v));
    return vals.length ? vals.filter((v) => toNumber(v, ctx.dataLocale) !== null).length / vals.length : 0;
  };

  // Longest run of consecutive columns with the same period type and mostly numeric values.
  let best: { start: number; end: number } | null = null;
  let i = 0;
  while (i < cols.length) {
    const h = headers[i];
    if (!h || numericShare(i) < 0.8) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < cols.length && headers[j + 1]?.type === h.type && numericShare(j + 1) >= 0.8) j++;
    if (j - i + 1 >= 3 && (!best || j - i > best.end - best.start)) best = { start: i, end: j };
    i = j + 1;
  }
  if (!best) return [];
  const run = headers.slice(best.start, best.end + 1) as PeriodHeader[];
  const type = run[0].type;
  const count = run.length;
  const fallbackYear = firstYear([ctx.sheetName, ctx.datasetName, ...ctx.notes]);

  let periods: Array<string | number>;
  let periodName: Localized;
  let year: number | undefined;
  if (type === 'month') {
    const months = run as Array<Extract<PeriodHeader, { type: 'month' }>>;
    year = months.find((m) => m.year)?.year ?? fallbackYear;
    periods = months.map((m) => (m.year ?? year ? `${m.year ?? year}-${pad(m.month)}-01` : m.month));
    periodName = { fi: 'Kuukausi', en: 'Month' };
  } else if (type === 'quarter') {
    const qs = run as Array<Extract<PeriodHeader, { type: 'quarter' }>>;
    year = qs.find((q) => q.year)?.year ?? fallbackYear;
    periods = qs.map((q) => (q.year ?? year ? `${q.year ?? year}-${pad((q.quarter - 1) * 3 + 1)}-01` : q.quarter));
    periodName = { fi: 'Kvartaali', en: 'Quarter' };
  } else if (type === 'year') {
    periods = (run as Array<Extract<PeriodHeader, { type: 'year' }>>).map((y) => y.year);
    periodName = { fi: 'Vuosi', en: 'Year' };
  } else {
    periods = (run as Array<Extract<PeriodHeader, { type: 'date' }>>).map((d) => d.iso);
    periodName = { fi: 'Päivämäärä', en: 'Date' };
  }
  const strong = (type === 'month' && count >= 6) || (type !== 'month' && count >= 3);
  const valueIds = cols.slice(best.start, best.end + 1).map((c) => c.id);
  return [
    {
      kind: 'unpivot',
      params: {
        idColumnIds: cols.filter((c) => !valueIds.includes(c.id)).map((c) => c.id),
        valueColumnIds: valueIds,
        periodName,
        valueName: valueNameFrom(ctx.sheetName ?? ctx.datasetName),
        periodParse: type,
        year,
        periods,
        periodColumnId: 'col_period',
        valueColumnId: 'col_value',
      },
      confidence: strong ? 0.85 : 0.7,
      threshold: 0.85,
    },
  ];
}
