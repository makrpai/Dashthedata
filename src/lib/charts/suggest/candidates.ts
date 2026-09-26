import { quoteIdent } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';
import { newId } from '@/lib/util/id';
import { linearRegression, mean, stddev } from '@/lib/util/stats';
import type { ChartSpec, ColumnProfile, Dataset, TimeGrain } from '@/types/domain';
import { aggSql, dimensionSql } from '../queryBuilder';
import { chooseGrain, defaultAgg, finalScore, importance } from './scoring';

const col = (c: ColumnProfile) => `col:${c.id}`;
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function base(dataset: Dataset, partial: Omit<ChartSpec, 'id' | 'datasetId' | 'origin'>): ChartSpec {
  return { id: newId('ch'), datasetId: dataset.id, origin: 'rule', ...partial };
}

/**
 * Spikes: leave-one-out z-scores of the residuals around the linear trend, so a steady trend is not
 * mistaken for an anomaly and a single spike stands out even in a short series. `avg` is the mean of
 * the other points (for the "Why this?" text).
 */
export function spikes(values: number[], threshold = 3): Array<{ index: number; z: number; avg: number }> {
  const out: Array<{ index: number; z: number; avg: number }> = [];
  if (values.length < 5) return out;
  const { slope, intercept } = linearRegression(values);
  const residuals = values.map((v, i) => v - (intercept + slope * i));
  residuals.forEach((r, i) => {
    const others = residuals.filter((_, j) => j !== i);
    const m = mean(others);
    const sd = stddev(others);
    if (sd > 0 && Math.abs((r - m) / sd) > threshold) {
      out.push({ index: i, z: (r - m) / sd, avg: mean(values.filter((_, j) => j !== i)) });
    }
  });
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

interface Ctx {
  runner: QueryRunner;
  dataset: Dataset;
  table: string;
}

async function series(ctx: Ctx, time: ColumnProfile, grain: TimeGrain, measure: ColumnProfile, dim?: ColumnProfile) {
  const agg = aggSql(defaultAgg(measure), measure);
  const x = dimensionSql(time, grain);
  if (!dim) {
    return ctx.runner.query<{ x: string; y: number | null }>(
      `SELECT ${x} AS x, ${agg} AS y FROM ${ctx.table} WHERE ${quoteIdent(time.sqlName)} IS NOT NULL GROUP BY 1 ORDER BY 1`,
    );
  }
  return ctx.runner.query<{ x: string; s: string; y: number | null }>(
    `SELECT ${x} AS x, ${dimensionSql(dim)} AS s, ${agg} AS y FROM ${ctx.table} WHERE ${quoteIdent(time.sqlName)} IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2`,
  );
}

/** Builds and scores every candidate of table 12.3, with precomputed "Why this?" numbers (12.5). */
export async function buildCandidates(runner: QueryRunner, dataset: Dataset): Promise<ChartSpec[]> {
  const ctx: Ctx = { runner, dataset, table: quoteIdent(dataset.outputTable) };
  const cols = dataset.columns;
  const measures = cols.filter((c) => c.role === 'measure' && (c.type === 'integer' || c.type === 'decimal')).sort((a, b) => importance(b) - importance(a));
  const times = cols.filter((c) => c.role === 'time' && (c.type === 'date' || c.type === 'datetime'));
  const dims = cols.filter((c) => (c.role === 'dimension' || (c.type === 'boolean' && c.role !== 'id')) && c.stats.distinct >= 2);
  const time = times[0];
  const out: ChartSpec[] = [];

  // KPI: top 4 measures.
  for (const m of measures.slice(0, 4)) {
    const agg = defaultAgg(m);
    out.push(
      base(dataset, {
        type: 'kpi',
        y: [{ columnId: m.id, agg }],
        x: time ? { columnId: time.id } : undefined,
        options: time ? { compareToPrevious: true } : undefined,
        autoTitle: { key: 'chart.title.kpi', params: { measure: col(m) } },
        reason: { key: 'reason.kpi', params: {} },
        score: finalScore(0.7, time ? 0.1 : 0, m, [m]),
      }),
    );
  }

  if (time) {
    const grain = chooseGrain(time);
    for (const m of measures.slice(0, 3)) {
      const agg = defaultAgg(m);
      const rows = (await series(ctx, time, grain, m)).filter((r) => typeof r.y === 'number');
      if (rows.length < 3) continue;
      const ys = rows.map((r) => r.y as number);
      const reg = linearRegression(ys);
      const sp = spikes(ys);
      const first = ys[0];
      const last = ys[ys.length - 1];
      const pct = first ? ((last - first) / Math.abs(first)) * 100 : 0;
      const reason: NonNullable<ChartSpec["reason"]> = sp.length
        ? { key: 'reason.anomaly', params: { period: `date:${grain}:${rows[sp[0].index].x}`, value: `num:${col(m)}:${ys[sp[0].index]}`, avg: `num:${col(m)}:${sp[0].avg}` } }
        : { key: pct >= 0 ? 'reason.trendUp' : 'reason.trendDown', params: { measure: col(m), pct: round(Math.abs(pct)), from: `date:${grain}:${rows[0].x}`, to: `date:${grain}:${rows[rows.length - 1].x}` } };
      out.push(
        base(dataset, {
          type: 'line',
          x: { columnId: time.id, timeGrain: grain },
          y: [{ columnId: m.id, agg }],
          autoTitle: { key: 'chart.title.overTime', params: { measure: col(m) } },
          reason,
          score: finalScore(0.7, 0.2 * reg.r2 + (sp.length ? 0.1 : 0), m, [time, m]),
        }),
      );
      // Trend by series: dims with 2–7 values.
      for (const d of dims.filter((x) => x.stats.distinct >= 2 && x.stats.distinct <= 7).slice(0, 3)) {
        const srows = (await series(ctx, time, grain, m, d)) as Array<{ x: string; s: string; y: number | null }>;
        const bySeries = new Map<string, Array<{ x: string; y: number }>>();
        for (const r of srows) if (typeof r.y === 'number') bySeries.set(r.s, [...(bySeries.get(r.s) ?? []), { x: r.x, y: r.y }]);
        const slopes = [...bySeries.values()].filter((v) => v.length >= 3).map((v) => {
          const reg2 = linearRegression(v.map((p) => p.y));
          const avg = mean(v.map((p) => p.y)) || 1;
          return reg2.slope / Math.abs(avg);
        });
        const differ = slopes.length >= 2 && stddev(slopes) > 0.02;
        let best: { s: string; x: string; value: number; avg: number; z: number } | null = null;
        for (const [s, v] of bySeries) {
          const sp2 = spikes(v.map((p) => p.y))[0];
          if (sp2 && (!best || Math.abs(sp2.z) > Math.abs(best.z))) best = { s, x: v[sp2.index].x, value: v[sp2.index].y, avg: sp2.avg, z: sp2.z };
        }
        out.push(
          base(dataset, {
            type: 'line',
            x: { columnId: time.id, timeGrain: grain },
            y: [{ columnId: m.id, agg }],
            series: { columnId: d.id },
            autoTitle: { key: 'chart.title.overTimeBy', params: { measure: col(m), series: col(d) } },
            reason: best
              ? { key: 'reason.anomalySeries', params: { series: `cat:${best.s}`, period: `date:${grain}:${best.x}`, value: `num:${col(m)}:${best.value}`, avg: `num:${col(m)}:${best.avg}` } }
              : { key: 'reason.seriesTrend', params: { measure: col(m), dimension: col(d) } },
            score: finalScore(0.55, (differ ? 0.15 : 0) + (best ? 0.1 + Math.min(0.1, (Math.abs(best.z) - 3) * 0.01) : 0), m, [time, m, d]),
          }),
        );
      }
    }
  }

  // Comparison bars and shares.
  for (const d of dims.filter((x) => x.stats.distinct >= 2 && x.stats.distinct <= 30)) {
    for (const m of measures.slice(0, 2)) {
      const agg = defaultAgg(m);
      const rows = await runner.query<{ x: string; y: number | null }>(
        `SELECT ${dimensionSql(d)} AS x, ${aggSql(agg, m)} AS y FROM ${ctx.table} GROUP BY 1 ORDER BY 2 DESC NULLS LAST`,
      );
      const vals = rows.map((r) => r.y ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const distinct = rows.length;
      const top3 = total > 0 && agg === 'sum' ? vals.slice(0, 3).reduce((a, b) => a + b, 0) / total : 0;
      const concentration = Math.max(0, top3 - 3 / Math.max(distinct, 3));
      const avgLen = rows.reduce((s, r) => s + String(r.x).length, 0) / Math.max(1, rows.length);
      out.push(
        base(dataset, {
          type: avgLen > 12 ? 'hbar' : 'bar',
          x: { columnId: d.id },
          y: [{ columnId: m.id, agg }],
          autoTitle: { key: 'chart.title.byDimension', params: { measure: col(m), dimension: col(d) } },
          reason:
            agg === 'sum' && distinct > 3
              ? { key: 'reason.concentration', params: { dimension: col(d), measure: col(m), pct: round(top3 * 100) } }
              : { key: 'reason.comparison', params: { dimension: col(d), measure: col(m), top: `cat:${rows[0]?.x ?? ''}` } },
          score: finalScore(0.6, 0.2 * concentration + (distinct >= 3 && distinct <= 12 ? 0.1 : 0), m, [d, m]),
        }),
      );
      if (distinct >= 2 && distinct <= 6 && agg === 'sum' && vals.every((v) => v >= 0) && total > 0) {
        const share = vals[0] / total;
        out.push(
          base(dataset, {
            type: 'donut',
            x: { columnId: d.id },
            y: [{ columnId: m.id, agg }],
            autoTitle: { key: 'chart.title.shareBy', params: { measure: col(m), dimension: col(d) } },
            reason: { key: 'reason.share', params: { top: `cat:${rows[0].x}`, pct: round(share * 100) } },
            score: finalScore(0.35, share > 0.5 ? 0.1 : 0, m, [d, m]),
          }),
        );
      }
    }
  }

  // Scatter for correlated measure pairs.
  if (dataset.rowCount >= 20) {
    for (let i = 0; i < measures.length; i++) {
      for (let j = i + 1; j < measures.length; j++) {
        const a = measures[i];
        const b = measures[j];
        const [r] = await runner.query<{ r: number | null }>(
          `SELECT corr(CAST(${quoteIdent(a.sqlName)} AS DOUBLE), CAST(${quoteIdent(b.sqlName)} AS DOUBLE)) AS r FROM ${ctx.table}`,
        );
        const rv = r?.r ?? 0;
        if (rv === null || Number.isNaN(rv) || Math.abs(rv) < 0.4 || Math.abs(rv) > 0.999) continue;
        out.push(
          base(dataset, {
            type: 'scatter',
            x: { columnId: a.id },
            y: [{ columnId: b.id, agg: 'sum' }],
            autoTitle: { key: 'chart.title.relation', params: { a: col(a), b: col(b) } },
            reason: { key: rv > 0 ? 'reason.correlationPos' : 'reason.correlationNeg', params: { a: col(a), b: col(b), r: round(rv, 2) } },
            score: finalScore(0.4, 0.4 * Math.abs(rv), b, [a, b]),
          }),
        );
      }
    }
  }

  // Distribution.
  for (const m of measures.slice(0, 3)) {
    if (m.stats.distinct < 20) continue;
    const skew = m.stats.skewness ?? 0;
    out.push(
      base(dataset, {
        type: 'histogram',
        x: { columnId: m.id, bins: 20 },
        y: [{ columnId: '*', agg: 'count' }],
        autoTitle: { key: 'chart.title.distribution', params: { measure: col(m) } },
        reason:
          Math.abs(skew) > 1
            ? { key: 'reason.distribution', params: { measure: col(m), median: `num:${col(m)}:${m.stats.median ?? 0}`, mean: `num:${col(m)}:${m.stats.mean ?? 0}` } }
            : { key: 'reason.distributionEven', params: { measure: col(m) } },
        score: finalScore(0.3, Math.abs(skew) > 1 ? 0.2 : 0, m, [m]),
      }),
    );
  }

  // Heatmap: two small dimensions.
  const small = dims.filter((d) => d.stats.distinct <= 15);
  if (small.length >= 2 && measures[0]) {
    const [d1, d2] = small;
    const m = measures[0];
    const agg = defaultAgg(m);
    const [cv] = await runner.query<{ cv: number | null }>(
      `SELECT stddev_samp(v) / nullif(avg(v), 0) AS cv FROM (SELECT ${aggSql(agg, m)} AS v FROM ${ctx.table} GROUP BY ${quoteIdent(d1.sqlName)}, ${quoteIdent(d2.sqlName)})`,
    );
    out.push(
      base(dataset, {
        type: 'heatmap',
        x: { columnId: d1.id },
        series: { columnId: d2.id },
        y: [{ columnId: m.id, agg }],
        autoTitle: { key: 'chart.title.heatmap', params: { measure: col(m), dimension: col(d1), series: col(d2) } },
        reason: { key: 'reason.heatmap', params: { dimension: col(d1), series: col(d2) } },
        score: finalScore(0.35, (cv?.cv ?? 0) > 1 ? 0.15 : 0, m, [d1, d2, m]),
      }),
    );
  }

  // Top list for identifiers or long text dimensions.
  const listDim = cols.find((c) => (c.role === 'id' || c.role === 'text' || c.role === 'dimension') && c.stats.distinct > 30 && c.type === 'text');
  if (listDim && measures[0]) {
    const m = measures[0];
    out.push(
      base(dataset, {
        type: 'table',
        x: { columnId: listDim.id },
        y: [{ columnId: m.id, agg: defaultAgg(m) }],
        limit: 20,
        autoTitle: { key: 'chart.title.topList', params: { measure: col(m), dimension: col(listDim) } },
        reason: { key: 'reason.topList', params: { dimension: col(listDim) } },
        score: finalScore(0.3, 0, m, [listDim, m]),
      }),
    );
  }
  return out;
}
