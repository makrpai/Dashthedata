import { quoteIdent } from '@/lib/duckdb/sql';
import { parseDateWith } from '@/lib/profile/dateFormat';
import { parseNumberAuto, preprocessNumber } from '@/lib/profile/numberFormat';
import type { ColumnRef, DetectContext } from '../types';

export const TOTAL_RE = /^(yhteensä|yht\.?|kaikki yhteensä|summa|välisumma|kokonaismäärä|total|grand total|sum|subtotal|totals)$/i;

export type Cells = Array<string | null>;

/** First `limit` rows of the current stage as strings, in row order, with their __row. */
export async function fetchRows(ctx: DetectContext, limit?: number, columns = ctx.columns): Promise<{ rows: Cells[]; rowNumbers: number[] }> {
  const select = columns.map((c) => `CAST(${quoteIdent(c.sqlName)} AS VARCHAR) AS ${quoteIdent(c.id)}`).join(', ');
  const data = await ctx.runner.query(
    `SELECT "__row", ${select || '1 AS "_"'} FROM ${ctx.from} ORDER BY "__row"${limit ? ` LIMIT ${limit}` : ''}`,
  );
  return {
    rows: data.map((r) => columns.map((c) => (r[c.id] === null || r[c.id] === undefined ? null : String(r[c.id])))),
    rowNumbers: data.map((r) => Number(r.__row)),
  };
}

export const isEmpty = (v: string | null) => v === null || v.trim() === '';

/** Number or date (used to tell header text from data). */
export function isNumberOrDate(v: string): boolean {
  const s = v.trim();
  if (preprocessNumber(s)) return true;
  return (['iso', 'isoMonth', 'dotted', 'dmy'] as const).some((f) => parseDateWith(s, f) !== null);
}

/** Lenient per-value number parsing for detection heuristics. */
export function toNumber(v: string | null, locale: 'fi' | 'en'): number | null {
  if (v === null) return null;
  return parseNumberAuto(v, locale)?.value ?? null;
}

export const textual = (c: ColumnRef) => c.type === 'varchar' || c.type === 'text';
