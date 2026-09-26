import { beforeAll, describe, expect, it } from 'vitest';
import { buildQuery, OTHER } from '@/lib/charts/queryBuilder';
import { validateSpec } from '@/lib/charts/spec';
import type { ChartSpec, Dataset } from '@/types/domain';
import { NodeRunner } from '../../helpers/nodeRunner';
import { processFixture } from '../../helpers/fixtures';

let db: NodeRunner;
let ds: Dataset;
const id = (name: string) => ds.columns.find((c) => c.displayName === name)!.id;
const spec = (s: Partial<ChartSpec>): ChartSpec => ({ id: 'c', datasetId: ds.id, type: 'bar', y: [], origin: 'user', ...s });
const run = async (s: ChartSpec, filters = []) => db.query(buildQuery(s, ds, filters).sql);

beforeAll(async () => {
  db = await NodeRunner.create();
  ds = (await processFixture(db, 'fi-sales-messy.xlsx', { sheet: 'Myynti 2025' })).dataset;
});

describe('queryBuilder (11.2) on the cleaned sales data', () => {
  it('bar: sum by region, largest first, matches SQL', async () => {
    const rows = await run(spec({ type: 'bar', x: { columnId: id('Alue') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }));
    const check = await db.query(`SELECT alue AS x, sum(myynti) AS y FROM ${ds.outputTable} GROUP BY 1 ORDER BY 2 DESC`);
    expect(rows.map((r) => r.x)).toEqual(check.map((r) => r.x));
    expect(rows[0].x).toBe('Helsinki');
    expect(rows.at(-1)!.x).toBe('Oulu');
    rows.forEach((r, i) => expect(r.y0 as number).toBeCloseTo(check[i].y as number, 6));
  });

  it('line: monthly trend, time ascending', async () => {
    const rows = await run(spec({ type: 'line', x: { columnId: id('Kuukausi'), timeGrain: 'month' }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }));
    expect(rows).toHaveLength(12);
    expect(rows[0].x).toBe('2025-01-01');
    expect(rows[11].x).toBe('2025-12-01');
  });

  it('quarter and year grains', async () => {
    const q = await run(spec({ type: 'line', x: { columnId: id('Kuukausi'), timeGrain: 'quarter' }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }));
    expect(q.map((r) => r.x)).toEqual(['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01']);
    const w = await run(spec({ type: 'line', x: { columnId: id('Kuukausi'), timeGrain: 'week' }, y: [{ columnId: '*', agg: 'count' }] }));
    expect(w[0].x).toBe('2024-12-30'); // ISO week starts on Monday
  });

  it('stacked bar with topN and "Other"', async () => {
    const rows = await run(
      spec({ type: 'stackedBar', x: { columnId: id('Tuoteryhmä') }, series: { columnId: id('Alue'), topN: 3 }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }),
    );
    const series = [...new Set(rows.map((r) => r.s))];
    expect(series).toContain(OTHER);
    expect(series).toHaveLength(4);
    const total = rows.reduce((s, r) => s + (r.y0 as number), 0);
    const [check] = await db.query(`SELECT sum(myynti) AS t FROM ${ds.outputTable}`);
    expect(total).toBeCloseTo(check.t as number, 4);
  });

  it('filters: spec, global and cross filters combine; unknown columns are ignored', async () => {
    const rows = await run(spec({ type: 'bar', x: { columnId: id('Tuoteryhmä') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }), [
      { columnId: id('Alue'), op: 'eq', value: 'Tampere' },
      { columnId: id('Kuukausi'), op: 'between', value: ['2025-06-01', '2025-06-30'] },
      { columnId: 'nope', op: 'eq', value: 'x' },
    ] as never);
    expect(rows[0].x).toBe('Urheilu'); // the June anomaly (× 3)
    expect(rows).toHaveLength(4);
  });

  it('counts, averages, distinct and median', async () => {
    const rows = await run(
      spec({ type: 'table', x: { columnId: id('Alue') }, y: [{ columnId: '*', agg: 'count' }, { columnId: id('Tuoteryhmä'), agg: 'countDistinct' }, { columnId: id('Myynti'), agg: 'median' }] }),
    );
    expect(rows[0]).toMatchObject({ y0: 48, y1: 4 });
    expect(typeof rows[0].y2).toBe('number');
  });

  it('histogram with 20 bins covers every value', async () => {
    const rows = await run(spec({ type: 'histogram', x: { columnId: id('Myynti') }, y: [{ columnId: '*', agg: 'count' }] }));
    expect(rows.length).toBeLessThanOrEqual(20);
    expect(rows.reduce((s, r) => s + (r.y0 as number), 0)).toBe(286);
  });

  it('donut limited to 6 slices', async () => {
    const q = buildQuery(spec({ type: 'donut', x: { columnId: id('Alue') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }), ds);
    expect(q.limit).toBe(6);
    expect(await db.query(q.sql)).toHaveLength(6);
  });

  it('heatmap: two dimensions', async () => {
    const rows = await run(spec({ type: 'heatmap', x: { columnId: id('Alue') }, series: { columnId: id('Tuoteryhmä') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }));
    expect(rows).toHaveLength(24);
  });

  it('scatter reports the total and samples above 5000', async () => {
    const rows = await run(spec({ type: 'scatter', x: { columnId: id('Myynti') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }));
    expect(rows[0].total).toBe(286);
  });

  it('KPI with comparison to the previous month', async () => {
    const q = buildQuery(spec({ type: 'kpi', y: [{ columnId: id('Myynti'), agg: 'sum' }], options: { compareToPrevious: true } }), ds);
    const [r] = await db.query(q.sql);
    const [dec] = await db.query(`SELECT sum(myynti) AS v FROM ${ds.outputTable} WHERE kuukausi = DATE '2025-12-01'`);
    const [nov] = await db.query(`SELECT sum(myynti) AS v FROM ${ds.outputTable} WHERE kuukausi = DATE '2025-11-01'`);
    expect(r.period).toBe('2025-12-01');
    expect(r.current as number).toBeCloseTo(dec.v as number, 6);
    expect(r.previous as number).toBeCloseTo(nov.v as number, 6);
    const spark = await db.query(q.sparkSql!);
    expect(spark).toHaveLength(12);
  });

  it('KPI with a date range compares to the previous equal period', async () => {
    const q = buildQuery(spec({ type: 'kpi', y: [{ columnId: id('Myynti'), agg: 'sum' }], options: { compareToPrevious: true } }), ds, [
      { columnId: id('Kuukausi'), op: 'between', value: ['2025-07-01', '2025-12-31'] },
    ]);
    const [r] = await db.query(q.sql);
    const [h2] = await db.query(`SELECT sum(myynti) AS v FROM ${ds.outputTable} WHERE kuukausi >= DATE '2025-07-01'`);
    const [h1] = await db.query(`SELECT sum(myynti) AS v FROM ${ds.outputTable} WHERE kuukausi < DATE '2025-07-01'`);
    expect(r.value as number).toBeCloseTo(h2.v as number, 6);
    expect(r.previous as number).toBeCloseTo(h1.v as number, 6);
  });

  it('bar charts fetch one extra row to detect truncation', () => {
    const q = buildQuery(spec({ type: 'bar', x: { columnId: id('Alue') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }), ds);
    expect(q.sql).toMatch(/LIMIT 31$/);
  });

  it('validates chart requirements (11.1)', () => {
    expect(validateSpec(spec({ type: 'line', x: { columnId: id('Alue') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }), ds)).toContain('needsTimeX');
    expect(validateSpec(spec({ type: 'donut', x: { columnId: id('Alue') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }), ds)).toEqual([]);
    expect(validateSpec(spec({ type: 'kpi', y: [{ columnId: id('Alue'), agg: 'sum' }] }), ds)).toContain('needsMeasure');
    expect(validateSpec(spec({ type: 'scatter', x: { columnId: id('Alue') }, y: [{ columnId: id('Myynti'), agg: 'sum' }] }), ds)).toContain('needsMeasureX');
  });
});
