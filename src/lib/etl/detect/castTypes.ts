import { quoteIdent } from '@/lib/duckdb/sql';
import { inferColumnType, type CastColumn } from '@/lib/profile/inferType';
import type { DataWarning } from '@/types/domain';
import type { DetectContext, Proposal } from '../types';

/** Sample of non-empty text values of one column (≤ 10 000, reproducible). */
export async function sampleValues(ctx: DetectContext, sqlName: string, limit = 10000): Promise<string[]> {
  const x = quoteIdent(sqlName);
  const rows = await ctx.runner.query<{ v: string }>(
    `SELECT v FROM (SELECT CAST(${x} AS VARCHAR) AS v FROM ${ctx.from} WHERE ${x} IS NOT NULL AND trim(CAST(${x} AS VARCHAR)) <> '') ` +
      `USING SAMPLE reservoir(${limit} ROWS) REPEATABLE (42)`,
  );
  return rows.map((r) => r.v);
}

/** 8. Type inference for every text column (always applied). */
export async function detectTypes(ctx: DetectContext): Promise<Proposal[]> {
  const columns: CastColumn[] = [];
  const warnings: Record<string, DataWarning[]> = {};
  for (const c of ctx.columns) {
    if (c.type !== 'varchar' && !(ctx.typedAtSource && c.type === 'text')) continue;
    const values = await sampleValues(ctx, c.sqlName);
    const inference = inferColumnType(c.id, values, c.displayName, ctx.dataLocale, { canonicalNumbers: ctx.canonicalNumbers });
    if (inference.warnings.length) warnings[c.id] = inference.warnings;
    if (ctx.typedAtSource && inference.cast.to === 'text') continue;
    columns.push(inference.cast);
  }
  if (!columns.length && ctx.typedAtSource) return [];
  return [{ kind: 'castTypes', params: { columns, warnings }, confidence: 1, threshold: 0 }];
}
