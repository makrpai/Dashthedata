import { quoteIdent } from '@/lib/duckdb/sql';
import { levenshtein } from '@/lib/util/levenshtein';
import type { DetectContext, Proposal } from '../types';

export const normalizeCategory = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Groups spelling variants that differ only in case or spaces and maps them to the most common
 * variant (ties: first one starting with a capital letter).
 */
export function caseVariantMapping(counts: Array<{ value: string; count: number }>): Record<string, string> {
  const groups = new Map<string, Array<{ value: string; count: number }>>();
  for (const c of counts) {
    const key = normalizeCategory(c.value);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const mapping: Record<string, string> = {};
  for (const variants of groups.values()) {
    if (variants.length < 2) continue;
    const sorted = [...variants].sort(
      (a, b) => b.count - a.count || Number(/^\p{Lu}/u.test(b.value)) - Number(/^\p{Lu}/u.test(a.value)),
    );
    const target = sorted[0].value;
    for (const v of variants) if (v.value !== target) mapping[v.value] = target;
  }
  return mapping;
}

/** Typos: edit distance ≤ 1, length ≥ 5, the other value ≥ 10× more common. Never automatic. */
export function typoMapping(counts: Array<{ value: string; count: number }>): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const rare of counts) {
    if (rare.value.length < 5) continue;
    for (const common of counts) {
      if (common === rare || common.value.length < 5) continue;
      if (common.count < rare.count * 10) continue;
      if (levenshtein(normalizeCategory(rare.value), normalizeCategory(common.value)) === 1) {
        mapping[rare.value] = common.value;
        break;
      }
    }
  }
  return mapping;
}

/** 9. Spelling variants in category columns (9.4.5). */
export async function detectCategories(ctx: DetectContext): Promise<Proposal[]> {
  const proposals: Proposal[] = [];
  const maxDistinct = Math.max(50, ctx.rowCount * 0.05);
  for (const c of ctx.columns) {
    if (c.type !== 'text') continue;
    const x = quoteIdent(c.sqlName);
    const [info] = await ctx.runner.query<{ d: number; len: number | null }>(
      `SELECT count(DISTINCT ${x}) AS d, avg(length(${x})) AS len FROM ${ctx.from}`,
    );
    if (Number(info.d) > maxDistinct || Number(info.len ?? 0) > 40 || Number(info.d) < 2) continue;
    const counts = (
      await ctx.runner.query<{ value: string; count: number }>(
        `SELECT ${x} AS value, count(*) AS count FROM ${ctx.from} WHERE ${x} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1`,
      )
    ).map((r) => ({ value: String(r.value), count: Number(r.count) }));
    const exact = caseVariantMapping(counts);
    if (Object.keys(exact).length) {
      proposals.push({ kind: 'standardizeCategories', params: { columnId: c.id, mapping: exact }, confidence: 0.95, threshold: 0.9 });
    }
    const canonical = counts.filter((v) => !(v.value in exact));
    const typos = typoMapping(canonical);
    if (Object.keys(typos).length) {
      proposals.push({ kind: 'standardizeCategories', params: { columnId: c.id, mapping: typos }, confidence: 0.6, threshold: 0.9 });
    }
  }
  return proposals;
}
