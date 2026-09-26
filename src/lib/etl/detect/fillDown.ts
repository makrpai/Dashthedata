import { quoteIdent } from '@/lib/duckdb/sql';
import type { DetectContext, Proposal } from '../types';
import { textual } from './common';

/** 6. Merged-cell pattern: fill down (9.4.3). */
export async function detectFillDown(ctx: DetectContext): Promise<Proposal[]> {
  const cols = ctx.columns.filter(textual);
  if (!cols.length || ctx.columns.length < 2) return [];
  const all = ctx.columns;
  const found: Array<{ id: string; confidence: number }> = [];
  for (const c of cols) {
    const x = quoteIdent(c.sqlName);
    const others = all.filter((o) => o.id !== c.id);
    const filledOthers = others.map((o) => `CASE WHEN ${quoteIdent(o.sqlName)} IS NOT NULL THEN 1 ELSE 0 END`).join(' + ');
    const [r] = await ctx.runner.query(
      `SELECT count(*) AS n, count(*) FILTER (WHERE ${x} IS NULL) AS nulls, count(DISTINCT ${x}) AS d, ` +
        `(SELECT ${x} IS NULL FROM ${ctx.from} ORDER BY "__row" LIMIT 1) AS first_null, ` +
        `avg((${filledOthers}) / ${others.length}.0) FILTER (WHERE ${x} IS NULL) AS other_filled FROM ${ctx.from}`,
    );
    const n = Number(r.n);
    const share = n ? Number(r.nulls) / n : 0;
    if (share < 0.2 || share > 0.9) continue;
    if (r.first_null === true) continue;
    if (Number(r.other_filled ?? 0) < 0.5) continue;
    if (Number(r.d) > 50) continue;
    found.push({ id: c.id, confidence: ctx.mergedColumnIds.includes(c.id) ? 0.95 : 0.8 });
  }
  if (!found.length) return [];
  return [
    {
      kind: 'fillDown',
      params: { columnIds: found.map((f) => f.id) },
      confidence: Math.min(...found.map((f) => f.confidence)),
      threshold: 0.75,
    },
  ];
}
