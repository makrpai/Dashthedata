import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import type { Agg, ChartSpec, ColumnProfile, Dataset, FilterClause, TimeGrain } from '@/types/domain';
import { filterClauseSql } from './filterSql';
import { columnOf, isTime } from './spec';

export const OTHER = '__other__';
export const BLANK = '__blank__';
export const BAR_LIMIT = 30;
export const TABLE_LIMIT = 100;
export const SCATTER_SAMPLE = 5000;
export const DEFAULT_TOP_N = 7;

export type QueryShape = 'series' | 'kpi' | 'scatter' | 'histogram' | 'table';

export interface BuiltQuery {
  sql: string;
  shape: QueryShape;
  /** KPI trend line. */
  sparkSql?: string;
  /** Rows fetched beyond the display limit mean "showing the N largest". */
  limit?: number;
  /** The grain used for the comparison period (KPI). */
  compareGrain?: TimeGrain;
}

const q = (c: ColumnProfile) => quoteIdent(c.sqlName);

export function aggSql(agg: Agg, column: ColumnProfile | null): string {
  if (!column) return 'CAST(count(*) AS DOUBLE)';
  const x = q(column);
  switch (agg) {
    case 'count':
      return `CAST(count(${x}) AS DOUBLE)`;
    case 'countDistinct':
      return `CAST(count(DISTINCT ${x}) AS DOUBLE)`;
    case 'sum':
      return `CAST(sum(CAST(${x} AS DOUBLE)) AS DOUBLE)`;
    case 'avg':
      return `CAST(avg(CAST(${x} AS DOUBLE)) AS DOUBLE)`;
    case 'min':
      return `CAST(min(CAST(${x} AS DOUBLE)) AS DOUBLE)`;
    case 'max':
      return `CAST(max(CAST(${x} AS DOUBLE)) AS DOUBLE)`;
    case 'median':
      return `CAST(median(CAST(${x} AS DOUBLE)) AS DOUBLE)`;
  }
}

/** Dimension/time expression: time columns are truncated to the grain (ISO weeks start Monday). */
export function dimensionSql(column: ColumnProfile, grain?: TimeGrain): string {
  if ((column.type === 'date' || column.type === 'datetime') && grain) {
    return `CAST(date_trunc(${sqlLiteral(grain)}, ${q(column)}) AS DATE)`;
  }
  if (column.type === 'date' || column.type === 'datetime') return `CAST(${q(column)} AS DATE)`;
  if (column.type === 'integer' && isTime(column)) return q(column);
  return `coalesce(CAST(${q(column)} AS VARCHAR), ${sqlLiteral(BLANK)})`;
}

/** WHERE clause from spec filters plus dashboard filters; clauses on unknown columns are ignored (11.2). */
export function whereSql(dataset: Pick<Dataset, 'columns'>, clauses: FilterClause[]): string {
  const parts = clauses
    .map((cl) => {
      const col = columnOf(dataset, cl.columnId);
      return col ? filterClauseSql(cl, col) : null;
    })
    .filter((p): p is string => Boolean(p));
  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

function yColumns(spec: ChartSpec, dataset: Pick<Dataset, 'columns'>) {
  return spec.y.map((y) => ({ agg: y.agg, column: y.columnId === '*' ? null : (columnOf(dataset, y.columnId) ?? null) }));
}

/** Builds the SQL for a chart (11.2). Pure: same spec + filters → same SQL. */
export function buildQuery(spec: ChartSpec, dataset: Pick<Dataset, 'columns' | 'outputTable'>, filters: FilterClause[] = []): BuiltQuery {
  const table = quoteIdent(dataset.outputTable);
  const all = [...(spec.filters ?? []), ...filters];
  const where = whereSql(dataset, all);
  const base = `SELECT * FROM ${table} ${where}`.trim();
  const ys = yColumns(spec, dataset);
  const x = columnOf(dataset, spec.x?.columnId);

  switch (spec.type) {
    case 'kpi':
      return kpiQuery(spec, dataset, all, ys[0]);
    case 'histogram': {
      if (!x) throw new Error('histogram needs x');
      const bins = spec.x?.bins ?? 20;
      const v = `CAST(${q(x)} AS DOUBLE)`;
      return {
        shape: 'histogram',
        sql:
          `WITH base AS (${base}), vals AS (SELECT ${v} AS v FROM base WHERE ${q(x)} IS NOT NULL), ` +
          `b AS (SELECT min(v) AS mn, max(v) AS mx FROM vals), ` +
          `w AS (SELECT mn, CASE WHEN mx > mn THEN (mx - mn) / ${bins} ELSE 1 END AS width FROM b) ` +
          `SELECT least(CAST(floor((v - mn) / width) AS INTEGER), ${bins - 1}) AS bin, ` +
          `any_value(mn + least(CAST(floor((v - mn) / width) AS INTEGER), ${bins - 1}) * width) AS "from", ` +
          `any_value(mn + (least(CAST(floor((v - mn) / width) AS INTEGER), ${bins - 1}) + 1) * width) AS "to", ` +
          `CAST(count(*) AS DOUBLE) AS y0 FROM vals, w GROUP BY 1 ORDER BY 1`,
      };
    }
    case 'scatter': {
      if (!x || !ys[0].column) throw new Error('scatter needs x and y');
      const s = columnOf(dataset, spec.series?.columnId);
      const cols = [`CAST(${q(x)} AS DOUBLE) AS x`, `CAST(${q(ys[0].column)} AS DOUBLE) AS y0`];
      if (s) cols.push(`${dimensionSql(s)} AS s`);
      const inner = `SELECT ${cols.join(', ')} FROM base WHERE ${q(x)} IS NOT NULL AND ${q(ys[0].column)} IS NOT NULL`;
      return {
        shape: 'scatter',
        sql:
          `WITH base AS (${base}), pts AS (${inner}), n AS (SELECT count(*) AS total FROM pts) ` +
          `SELECT pts.*, n.total FROM (SELECT * FROM pts USING SAMPLE reservoir(${SCATTER_SAMPLE} ROWS) REPEATABLE (42)) pts, n`,
      };
    }
    case 'table':
      return tableQuery(spec, dataset, base, ys);
    default:
      return seriesQuery(spec, dataset, base, ys);
  }
}

function seriesQuery(
  spec: ChartSpec,
  dataset: Pick<Dataset, 'columns'>,
  base: string,
  ys: Array<{ agg: Agg; column: ColumnProfile | null }>,
): BuiltQuery {
  const x = columnOf(dataset, spec.x?.columnId);
  if (!x) throw new Error('chart needs x');
  const s = columnOf(dataset, spec.series?.columnId);
  const xExpr = dimensionSql(x, spec.x?.timeGrain);
  const measures = ys.map((y, i) => `${aggSql(y.agg, y.column)} AS y${i}`);
  const time = isTime(x) && x.type !== 'text';
  const heat = spec.type === 'heatmap';
  const limitedX = !time && (spec.type === 'bar' || spec.type === 'hbar' || spec.type === 'donut' || spec.type === 'stackedBar' || heat);
  const limit = spec.limit ?? (heat ? 15 : spec.type === 'donut' ? 6 : BAR_LIMIT);

  let sql: string;
  if (s) {
    const topN = heat ? 15 : (spec.series?.topN ?? DEFAULT_TOP_N);
    const sExpr = dimensionSql(s);
    const rankAgg = aggSql(ys[0].agg, ys[0].column);
    sql =
      `WITH base AS (SELECT *, ${xExpr} AS "__x", ${sExpr} AS "__s" FROM (${base})), ` +
      `ranked AS (SELECT "__s", row_number() OVER (ORDER BY ${rankAgg} DESC NULLS LAST, "__s") AS rn FROM base GROUP BY "__s") ` +
      (limitedX
        ? `, xs AS (SELECT "__x" FROM base GROUP BY "__x" ORDER BY ${rankAgg} DESC NULLS LAST, "__x" LIMIT ${limit}) `
        : '') +
      `SELECT b."__x" AS x, CASE WHEN r.rn <= ${topN} THEN b."__s" ELSE ${sqlLiteral(OTHER)} END AS s, ${measures.join(', ')} ` +
      `FROM base b JOIN ranked r USING ("__s")${limitedX ? ' WHERE b."__x" IN (SELECT "__x" FROM xs)' : ''} GROUP BY 1, 2 ORDER BY 1, 2`;
  } else {
    const order = time
      ? 'x ASC'
      : spec.sort
        ? `${spec.sort.by === 'x' ? 'x' : 'y0'} ${spec.sort.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`
        : 'y0 DESC NULLS LAST';
    sql =
      `SELECT ${xExpr} AS x, ${measures.join(', ')} FROM (${base}) GROUP BY 1 ORDER BY ${order}${order.startsWith('x') ? '' : ', x'}` +
      (limitedX ? ` LIMIT ${limit + 1}` : '');
  }
  return { shape: 'series', sql, limit: limitedX && !s ? limit : undefined };
}

function tableQuery(
  spec: ChartSpec,
  dataset: Pick<Dataset, 'columns'>,
  base: string,
  ys: Array<{ agg: Agg; column: ColumnProfile | null }>,
): BuiltQuery {
  const limit = spec.limit ?? TABLE_LIMIT;
  const x = columnOf(dataset, spec.x?.columnId);
  if (x) {
    const measures = ys.map((y, i) => `${aggSql(y.agg, y.column)} AS y${i}`);
    const dir = spec.sort?.dir === 'asc' ? 'ASC' : 'DESC';
    const by = spec.sort?.by === 'x' ? 'x' : measures.length ? 'y0' : 'x';
    return {
      shape: 'table',
      sql: `SELECT ${dimensionSql(x, spec.x?.timeGrain)} AS x${measures.length ? `, ${measures.join(', ')}` : ''} FROM (${base}) GROUP BY 1 ORDER BY ${by} ${dir} NULLS LAST, x LIMIT ${limit + 1}`,
      limit,
    };
  }
  const cols = (spec.columns?.length ? spec.columns : dataset.columns.map((c) => c.id))
    .map((id) => columnOf(dataset, id))
    .filter((c): c is ColumnProfile => Boolean(c));
  return {
    shape: 'table',
    sql: `SELECT ${cols.map(q).join(', ') || '*'} FROM (${base}) ORDER BY "__row" LIMIT ${limit + 1}`,
    limit,
  };
}

function kpiQuery(
  spec: ChartSpec,
  dataset: Pick<Dataset, 'columns' | 'outputTable'>,
  filters: FilterClause[],
  y: { agg: Agg; column: ColumnProfile | null },
): BuiltQuery {
  const table = quoteIdent(dataset.outputTable);
  const agg = aggSql(y.agg, y.column);
  const timeCol =
    columnOf(dataset, spec.x?.columnId) ?? dataset.columns.find((c) => c.role === 'time' && (c.type === 'date' || c.type === 'datetime'));
  const base = `SELECT * FROM ${table} ${whereSql(dataset, filters)}`.trim();
  if (!timeCol || !(timeCol.type === 'date' || timeCol.type === 'datetime') || !spec.options?.compareToPrevious) {
    return { shape: 'kpi', sql: `SELECT ${agg} AS value FROM (${base})` };
  }
  const t = `CAST(${q(timeCol)} AS DATE)`;
  const range = filters.find((f) => f.columnId === timeCol.id && f.op === 'between' && Array.isArray(f.value));
  const spark =
    `SELECT CAST(date_trunc('month', ${t}) AS DATE) AS x, ${agg} AS y0 FROM (${base}) WHERE ${q(timeCol)} IS NOT NULL GROUP BY 1 ORDER BY 1`;
  if (range) {
    // Selected range vs an equally long period right before it.
    const others = filters.filter((f) => f !== range);
    const unfiltered = `SELECT * FROM ${table} ${whereSql(dataset, others)}`.trim();
    const [a, b] = range.value as [string | number, string | number];
    const from = `CAST(${sqlLiteral(String(a))} AS DATE)`;
    const to = `CAST(${sqlLiteral(String(b))} AS DATE)`;
    return {
      shape: 'kpi',
      sparkSql: spark,
      sql:
        `SELECT (SELECT ${agg} FROM (${base})) AS value, ` +
        `(SELECT ${agg} FROM (${unfiltered}) WHERE ${t} BETWEEN ${from} - CAST(${to} - ${from} + 1 AS INTEGER) AND ${from} - CAST(1 AS INTEGER)) AS previous, ` +
        `NULL AS period, 'range' AS mode`,
    };
  }
  const monthly = timeCol.format?.timeGrainHint === 'month';
  return {
    shape: 'kpi',
    sparkSql: spark,
    compareGrain: 'month',
    sql:
      `WITH base AS (${base}), m AS (SELECT CAST(date_trunc('month', max(${t})) AS DATE) AS last_m, max(${t}) AS mx, ` +
      `count(DISTINCT date_trunc('month', ${t})) AS nm FROM base), ` +
      `p AS (SELECT CASE WHEN ${monthly ? 'TRUE' : 'mx >= last_day(last_m)'} THEN last_m ELSE CAST(last_m - INTERVAL 1 MONTH AS DATE) END AS period, nm FROM m) ` +
      `SELECT (SELECT ${agg} FROM base) AS value, ` +
      `(SELECT ${agg} FROM base, p WHERE date_trunc('month', ${t}) = p.period) AS current, ` +
      `(SELECT ${agg} FROM base, p WHERE date_trunc('month', ${t}) = CAST(p.period - INTERVAL 1 MONTH AS DATE)) AS previous, ` +
      `(SELECT period FROM p) AS period, (SELECT nm FROM p) AS months, 'month' AS mode`,
  };
}
