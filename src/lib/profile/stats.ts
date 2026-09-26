import { quoteIdent } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';
import type { ColumnStats, ColumnType } from '@/types/domain';

export interface StatsColumn {
  sqlName: string;
  type: ColumnType;
  /** Whether to compute the top-10 value list. */
  top: boolean;
  /** Whether to compute a histogram (20 equal-width bins). */
  histogram: boolean;
}

export interface ColumnStatsResult extends ColumnStats {
  avgLength?: number;
  lengthStddev?: number;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const numeric = (t: ColumnType) => t === 'integer' || t === 'decimal';

/**
 * Column statistics (8.6): one aggregate query for all columns, then top values and histograms.
 * Large tables are profiled on a reproducible sample (19.2).
 */
export async function computeStats(
  runner: QueryRunner,
  table: string,
  columns: StatsColumn[],
  rowCount: number,
): Promise<ColumnStatsResult[]> {
  if (columns.length === 0) return [];
  const sampled = rowCount > 2_000_000;
  const from = sampled
    ? `(SELECT * FROM ${quoteIdent(table)} USING SAMPLE reservoir(1000000 ROWS) REPEATABLE (42))`
    : quoteIdent(table);

  const parts: string[] = ['count(*) AS "n"'];
  columns.forEach((c, i) => {
    const col = quoteIdent(c.sqlName);
    parts.push(`count(${col}) AS "c${i}_count"`, `count(DISTINCT ${col}) AS "c${i}_distinct"`);
    if (numeric(c.type)) {
      const d = `CAST(${col} AS DOUBLE)`;
      parts.push(
        `min(${d}) AS "c${i}_min"`,
        `max(${d}) AS "c${i}_max"`,
        `avg(${d}) AS "c${i}_mean"`,
        `median(${d}) AS "c${i}_median"`,
        `stddev_samp(${d}) AS "c${i}_stddev"`,
        `sum(${d}) AS "c${i}_sum"`,
        `skewness(${d}) AS "c${i}_skew"`,
      );
    } else if (c.type === 'date' || c.type === 'datetime') {
      parts.push(`CAST(min(${col}) AS VARCHAR) AS "c${i}_min"`, `CAST(max(${col}) AS VARCHAR) AS "c${i}_max"`);
    } else if (c.type === 'text') {
      parts.push(
        `min(${col}) AS "c${i}_min"`,
        `max(${col}) AS "c${i}_max"`,
        `avg(length(${col})) AS "c${i}_len"`,
        `stddev_pop(length(${col})) AS "c${i}_lensd"`,
      );
    }
  });
  const [row] = await runner.query(`SELECT ${parts.join(', ')} FROM ${from}`);
  const total = Number(row.n ?? 0);
  const scale = sampled && total > 0 ? rowCount / total : 1;

  const results: ColumnStatsResult[] = columns.map((c, i) => {
    const count = Number(row[`c${i}_count`] ?? 0);
    const stats: ColumnStatsResult = {
      count: rowCount,
      nulls: Math.round((total - count) * scale),
      distinct: Number(row[`c${i}_distinct`] ?? 0),
    };
    if (numeric(c.type)) {
      stats.min = num(row[`c${i}_min`]);
      stats.max = num(row[`c${i}_max`]);
      stats.mean = num(row[`c${i}_mean`]);
      stats.median = num(row[`c${i}_median`]);
      stats.stddev = num(row[`c${i}_stddev`]);
      stats.sum = num(row[`c${i}_sum`]) !== undefined ? num(row[`c${i}_sum`])! * scale : undefined;
      stats.skewness = num(row[`c${i}_skew`]);
    } else {
      const min = row[`c${i}_min`];
      const max = row[`c${i}_max`];
      if (typeof min === 'string') stats.min = min;
      if (typeof max === 'string') stats.max = max;
      stats.avgLength = num(row[`c${i}_len`]);
      stats.lengthStddev = num(row[`c${i}_lensd`]);
    }
    return stats;
  });

  // Top values and histograms, one small query each.
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    const col = quoteIdent(c.sqlName);
    if (c.top) {
      const top = await runner.query<{ value: unknown; count: number }>(
        `SELECT CAST(${col} AS VARCHAR) AS value, count(*) AS count FROM ${from} WHERE ${col} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
      );
      results[i].top = top.map((t) => ({ value: String(t.value), count: Math.round(Number(t.count) * scale) }));
    }
    const s = results[i];
    if (c.histogram && typeof s.min === 'number' && typeof s.max === 'number') {
      const bins = 20;
      const min = s.min;
      const width = s.max > min ? (s.max - min) / bins : 1;
      const rows = await runner.query<{ b: number; count: number }>(
        `SELECT least(CAST(floor((CAST(${col} AS DOUBLE) - ${min}) / ${width}) AS INTEGER), ${bins - 1}) AS b, count(*) AS count ` +
          `FROM ${from} WHERE ${col} IS NOT NULL GROUP BY 1 ORDER BY 1`,
      );
      const counts = new Array<number>(s.max > min ? bins : 1).fill(0);
      for (const r of rows) counts[Math.max(0, Math.min(counts.length - 1, Number(r.b)))] += Math.round(Number(r.count) * scale);
      s.histogram = counts.map((count, b) => ({ from: min + b * width, to: min + (b + 1) * width, count }));
    }
  }
  return results;
}
