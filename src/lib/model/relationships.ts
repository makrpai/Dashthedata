import { slugify } from '@/lib/etl/slugify';
import { quoteIdent } from '@/lib/duckdb/sql';
import { similarity } from '@/lib/util/levenshtein';
import type { QueryRunner } from '@/lib/duckdb/types';
import type { ColumnProfile, Dataset, Relationship } from '@/types/domain';
import { newId } from '@/lib/util/id';

const KEY_SUFFIX = /_(id|nro|koodi|tunnus)$/;
const KEY_NAME = /^(id|tunnus|nro|koodi)$/;

/** 0.5 overlap + 0.3 uniqueness of the "one" side + 0.2 name similarity (10.2). */
export function relationshipScore(overlap: number, uniquenessTo: number, nameSimilarity: number): number {
  return 0.5 * overlap + 0.3 * uniquenessTo + 0.2 * nameSimilarity;
}

export function nameSimilarity(from: ColumnProfile, fromDataset: Dataset, to: ColumnProfile, toDataset: Dataset): number {
  const a = slugify(from.displayName);
  const b = slugify(to.displayName);
  let score = similarity(a, b);
  const base = a.replace(KEY_SUFFIX, '');
  const toName = slugify(toDataset.name);
  if (base && KEY_NAME.test(b) && (toName.includes(base) || base.includes(toName))) score = Math.max(score, 0.9);
  if (a === b) score = 1;
  return score;
}

async function measure(
  runner: QueryRunner,
  fromTable: string,
  fromCol: string,
  toTable: string,
  toCol: string,
): Promise<{ overlap: number; uniquenessTo: number; uniquenessFrom: number }> {
  const sql = `
    WITH f AS (SELECT DISTINCT CAST(${quoteIdent(fromCol)} AS VARCHAR) AS v FROM ${quoteIdent(fromTable)} WHERE ${quoteIdent(fromCol)} IS NOT NULL),
         d AS (SELECT DISTINCT CAST(${quoteIdent(toCol)} AS VARCHAR) AS v FROM ${quoteIdent(toTable)} WHERE ${quoteIdent(toCol)} IS NOT NULL)
    SELECT
      (SELECT count(*) FROM f) AS from_distinct,
      (SELECT count(*) FROM d) AS to_distinct,
      (SELECT count(*) FROM ${quoteIdent(toTable)} WHERE ${quoteIdent(toCol)} IS NOT NULL) AS to_rows,
      (SELECT count(*) FROM ${quoteIdent(fromTable)} WHERE ${quoteIdent(fromCol)} IS NOT NULL) AS from_rows,
      (SELECT count(*) FROM f WHERE v IN (SELECT v FROM d)) AS overlap_n
  `;
  const [row] = await runner.query<{ from_distinct: number; to_distinct: number; to_rows: number; from_rows: number; overlap_n: number }>(sql);
  const fromDistinct = Number(row?.from_distinct ?? 0);
  const toRows = Number(row?.to_rows ?? 0);
  const fromRows = Number(row?.from_rows ?? 0);
  return {
    overlap: fromDistinct === 0 ? 0 : Number(row?.overlap_n ?? 0) / fromDistinct,
    uniquenessTo: toRows === 0 ? 0 : Number(row?.to_distinct ?? 0) / toRows,
    uniquenessFrom: fromRows === 0 ? 0 : fromDistinct / fromRows,
  };
}

const eligible = (column: ColumnProfile) => column.role === 'id' || column.role === 'dimension';

/**
 * Suggests many-to-one relationships between id/dimension columns.
 * A suggestion needs overlap ≥ 0.5, a nearly unique "one" side and score ≥ 0.72.
 */
export async function detectRelationships(runner: QueryRunner, datasets: Dataset[]): Promise<Relationship[]> {
  const usable = datasets.filter((d) => d.columns.some(eligible) && d.outputTable);
  const found: Relationship[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = 0; j < usable.length; j++) {
      if (i === j) continue;
      const fromDs = usable[i];
      const toDs = usable[j];
      for (const fromCol of fromDs.columns.filter(eligible)) {
        for (const toCol of toDs.columns.filter(eligible)) {
          const names = nameSimilarity(fromCol, fromDs, toCol, toDs);
          let stats: { overlap: number; uniquenessTo: number; uniquenessFrom: number };
          try {
            stats = await measure(runner, fromDs.outputTable, fromCol.sqlName, toDs.outputTable, toCol.sqlName);
          } catch {
            continue;
          }
          if (stats.uniquenessTo + 0.02 < stats.uniquenessFrom) continue;
          const score = relationshipScore(stats.overlap, stats.uniquenessTo, names);
          if (stats.overlap < 0.5 || stats.uniquenessTo < 0.9 || score < 0.72) continue;
          found.push({
            id: newId('rel'),
            from: { datasetId: fromDs.id, columnId: fromCol.id },
            to: { datasetId: toDs.id, columnId: toCol.id },
            cardinality: stats.uniquenessFrom >= 0.95 && stats.uniquenessTo >= 0.95 ? 'one-to-one' : 'many-to-one',
            status: 'suggested',
            score,
            evidence: { overlap: stats.overlap, uniquenessTo: stats.uniquenessTo, nameSimilarity: names },
          });
        }
      }
    }
  }
  const best = new Map<string, Relationship>();
  for (const rel of found.sort((a, b) => b.score - a.score)) {
    const key = `${rel.from.datasetId}:${rel.from.columnId}`;
    if (!best.has(key)) best.set(key, rel);
  }
  return [...best.values()];
}
