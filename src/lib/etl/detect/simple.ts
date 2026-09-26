import { quoteIdent } from '@/lib/duckdb/sql';
import type { DetectContext, Proposal } from '../types';
import { isEmptySql } from '../steps/helpers';
import { textual } from './common';

/** 1. Columns that are completely empty or blank. */
export async function detectEmptyColumns(ctx: DetectContext): Promise<Proposal[]> {
  if (!ctx.columns.length) return [];
  const parts = ctx.columns.map((c, i) => `count(*) FILTER (WHERE NOT (${isEmptySql(c)})) AS "n${i}"`);
  const [r] = await ctx.runner.query(`SELECT ${parts.join(', ')} FROM ${ctx.from}`);
  const empty = ctx.columns.filter((_, i) => Number(r[`n${i}`]) === 0).map((c) => c.id);
  if (!empty.length || empty.length === ctx.columns.length) return [];
  return [{ kind: 'dropEmptyColumns', params: { columnIds: empty }, confidence: 1, threshold: 1 }];
}

/** 2. Rows where every cell is empty. */
export async function detectEmptyRows(ctx: DetectContext): Promise<Proposal[]> {
  if (!ctx.columns.length) return [];
  const [r] = await ctx.runner.query<{ n: number }>(
    `SELECT count(*) AS n FROM ${ctx.from} WHERE ${ctx.columns.map(isEmptySql).join(' AND ')}`,
  );
  return Number(r.n) > 0 ? [{ kind: 'dropEmptyRows', params: {}, confidence: 1, threshold: 1 }] : [];
}

/** 4. Leading/trailing or doubled spaces in text cells. */
export async function detectTrim(ctx: DetectContext): Promise<Proposal[]> {
  const cols = ctx.columns.filter(textual);
  if (!cols.length) return [];
  const parts = cols.map((c, i) => {
    const x = quoteIdent(c.sqlName);
    return `count(*) FILTER (WHERE ${x} IS NOT NULL AND (${x} <> regexp_replace(trim(${x}), '\\s+', ' ', 'g') OR trim(${x}) = '')) AS "n${i}"`;
  });
  const [r] = await ctx.runner.query(`SELECT ${parts.join(', ')} FROM ${ctx.from}`);
  const ids = cols.filter((_, i) => Number(r[`n${i}`]) > 0).map((c) => c.id);
  return ids.length ? [{ kind: 'trimWhitespace', params: { columnIds: ids }, confidence: 1, threshold: 1 }] : [];
}

/** 10. Fully identical rows: always a suggestion, never automatic. */
export async function detectDuplicates(ctx: DetectContext): Promise<Proposal[]> {
  if (!ctx.columns.length) return [];
  const cols = ctx.columns.map((c) => quoteIdent(c.sqlName)).join(', ');
  const [r] = await ctx.runner.query<{ n: number }>(
    `SELECT (SELECT count(*) FROM ${ctx.from}) - (SELECT count(*) FROM (SELECT DISTINCT ${cols} FROM ${ctx.from})) AS n`,
  );
  const n = Number(r.n);
  return n > 0 ? [{ kind: 'dedupe', params: {}, confidence: 0.5, threshold: 1.01 }] : [];
}
