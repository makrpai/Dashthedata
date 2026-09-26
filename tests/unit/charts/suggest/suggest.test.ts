import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { autoLayout, suggestCharts } from '@/lib/charts/suggest';
import { diversify } from '@/lib/charts/suggest/diversity';
import { chooseGrain, defaultAgg, importance } from '@/lib/charts/suggest/scoring';
import { spikes } from '@/lib/charts/suggest/candidates';
import { chartTitle, resolveReasonParams } from '@/lib/charts/labels';
import { createT } from '@/lib/i18n';
import type { ChartSpec, ColumnProfile, Dataset } from '@/types/domain';
import { NodeRunner } from '../../../helpers/nodeRunner';
import { processFixture } from '../../../helpers/fixtures';

let db: NodeRunner;
let sales: Dataset;
beforeAll(async () => {
  db = await NodeRunner.create();
  sales = (await processFixture(db, 'fi-sales-messy.xlsx', { sheet: 'Myynti 2025' })).dataset;
});

const name = (ds: Dataset, id?: string) => ds.columns.find((c) => c.id === id)?.displayName;

describe('suggestion engine (phase 5 acceptance)', () => {
  it('sales report: KPI row, trend first, comparisons by region and product group, anomaly reason', async () => {
    const { top } = await suggestCharts(db, sales);
    const nonKpi = top.filter((c) => c.type !== 'kpi');
    expect(top.filter((c) => c.type === 'kpi').length).toBeGreaterThanOrEqual(1);
    expect(nonKpi[0].type).toBe('line');
    expect(nonKpi[0].series).toBeUndefined();
    const bars = nonKpi.filter((c) => c.type === 'bar' || c.type === 'hbar').map((c) => name(sales, c.x?.columnId));
    expect(bars).toEqual(expect.arrayContaining(['Alue', 'Tuoteryhmä']));
    const t = createT('fi').dynamic;
    const texts = top
      .filter((c) => c.reason?.key === 'reason.anomalySeries')
      .map((c) => t(c.reason!.key, resolveReasonParams(c.reason!.params, sales, 'fi', t)));
    expect(texts.some((x) => x.includes('Tampere') && x.includes('kesä 2025'))).toBe(true);
    expect(chartTitle(nonKpi[0], sales, t)).toBe('Myynti ajan mukaan');
    expect(nonKpi.length).toBeLessThanOrEqual(8);
  });

  it('sales orders: scatter of discount × quantity', async () => {
    const orders = (await processFixture(db, join(__dirname, '../../../../public/samples/sales-orders.csv'), { dataLocale: 'en', locale: 'en' })).dataset;
    const { top, more } = await suggestCharts(db, orders);
    const scatter = [...top, ...more].find((c) => c.type === 'scatter');
    expect(scatter).toBeDefined();
    expect([name(orders, scatter!.x?.columnId), name(orders, scatter!.y[0].columnId)].sort()).toEqual(['discount_pct', 'quantity']);
    expect(top.some((c) => c.type === 'scatter')).toBe(true);
  });

  it('auto layout places KPIs, the trend full width and pairs', async () => {
    const { top } = await suggestCharts(db, sales);
    const dash = autoLayout(top, sales, 'Dashboard');
    const kpiTiles = dash.tiles.filter((tile) => top.find((c) => c.id === tile.chartId)?.type === 'kpi');
    expect(kpiTiles.every((tile) => tile.layout.w === 3 && tile.layout.h === 2 && tile.layout.y === 0)).toBe(true);
    const trend = dash.tiles.find((tile) => tile.chartId === top.find((c) => c.type === 'line' && !c.series)!.id)!;
    expect(trend.layout).toMatchObject({ x: 0, w: 12, h: 4 });
    const kinds = dash.globalFilters.map((f) => f.kind);
    expect(kinds[0]).toBe('dateRange');
    expect(kinds.filter((k) => k === 'multiSelect').length).toBeGreaterThanOrEqual(1);
    // No overlaps.
    for (const a of dash.tiles) for (const b of dash.tiles) {
      if (a === b) continue;
      const overlap = a.layout.x < b.layout.x + b.layout.w && b.layout.x < a.layout.x + a.layout.w && a.layout.y < b.layout.y + b.layout.h && b.layout.y < a.layout.y + a.layout.h;
      expect(overlap).toBe(false);
    }
  });
});

describe('scoring helpers', () => {
  const m = (displayName: string, extra: Partial<ColumnProfile> = {}): ColumnProfile => ({
    id: displayName, sqlName: displayName, displayName, type: 'decimal', role: 'measure',
    stats: { count: 100, nulls: 0, distinct: 50, stddev: 1, min: 0, max: 10 }, warnings: [], ...extra,
  });
  it('importance and default aggregation (12.1)', () => {
    expect(importance(m('Myynti'))).toBeCloseTo(1);
    expect(importance(m('Foo'))).toBeCloseTo(0.7);
    expect(defaultAgg(m('Hinta'))).toBe('avg');
    expect(defaultAgg(m('Myynti'))).toBe('sum');
    expect(defaultAgg(m('X', { format: { unit: 'percent' } }))).toBe('avg');
  });
  it('time grain (12.2)', () => {
    const tcol = (min: string, max: string) => m('Pvm', { type: 'date', role: 'time', stats: { count: 1, nulls: 0, distinct: 1, min, max } });
    expect(chooseGrain(tcol('2025-01-01', '2025-02-15'))).toBe('day');
    expect(chooseGrain(tcol('2025-01-01', '2025-10-01'))).toBe('week');
    expect(chooseGrain(tcol('2023-01-01', '2025-10-01'))).toBe('month');
    expect(chooseGrain(tcol('2015-01-01', '2025-10-01'))).toBe('quarter');
    expect(chooseGrain(tcol('1990-01-01', '2025-10-01'))).toBe('year');
  });
  it('leave-one-out spikes find a single outlier in a short series', () => {
    expect(spikes([10, 11, 10, 12, 11, 30, 10, 11])[0].index).toBe(5);
    expect(spikes([10, 11, 10, 12, 11, 10])).toEqual([]);
  });
  it('diversity limits (12.4)', () => {
    const c = (i: number, type: ChartSpec['type'], measure = `m${i % 3}`): ChartSpec => ({ id: `${i}`, datasetId: 'd', type, x: { columnId: `x${i}` }, y: [{ columnId: measure, agg: 'sum' }], origin: 'rule', score: 1 - i / 100 });
    const { top } = diversify([
      c(1, 'bar', 'm'), c(2, 'bar', 'm'), c(3, 'bar', 'm'), c(4, 'line', 'm'), c(5, 'donut', 'm'), c(11, 'scatter', 'm'),
      c(12, 'histogram', 'a'), c(13, 'table', 'b'),
      c(6, 'kpi'), c(7, 'kpi'), c(8, 'kpi'), c(9, 'kpi'), c(10, 'kpi'),
    ]);
    expect(top.filter((x) => x.type === 'bar')).toHaveLength(2);
    expect(top.filter((x) => x.type === 'kpi')).toHaveLength(4);
    expect(top.filter((x) => x.y[0].columnId === 'm' && x.type !== 'kpi')).toHaveLength(3);
  });
});
