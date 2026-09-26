import { describe, expect, it } from 'vitest';
import { chartSummary, toEChartsOption, type ChartTheme } from '@/lib/charts/echartsOption';
import { formatDate, formatNumber, escapeHtml } from '@/lib/charts/format';
import { chartTitle } from '@/lib/charts/labels';
import { createT } from '@/lib/i18n';
import type { ChartSpec, ColumnProfile, Dataset } from '@/types/domain';

const theme: ChartTheme = {
  palette: ['#2c62a8', '#e85d56', '#1b998b', '#8e5ba8', '#d69a1d', '#5aa9de', '#c4507f'],
  other: '#7d8aa6',
  text: '#0f2747',
  text2: '#4a5878',
  line: 'rgba(15,39,71,0.16)',
  surface: '#f8fafc',
  accent: '#e85d56',
  sequential: ['#dce6f3', '#2c62a8'],
  fontFamily: 'Manrope',
};
const col = (id: string, displayName: string, type: ColumnProfile['type'], role: ColumnProfile['role'], extra: Partial<ColumnProfile> = {}): ColumnProfile => ({
  id,
  sqlName: id,
  displayName,
  type,
  role,
  stats: { count: 10, nulls: 0, distinct: 3, top: [{ value: 'Helsinki', count: 5 }, { value: 'Tampere', count: 3 }, { value: 'Oulu', count: 2 }] },
  warnings: [],
  ...extra,
});
const dataset: Pick<Dataset, 'columns' | 'name'> = {
  name: 'Myynti 2025',
  columns: [
    col('alue', 'Alue', 'text', 'dimension'),
    col('kk', 'Kuukausi', 'date', 'time', { format: { timeGrainHint: 'month' } }),
    col('myynti', 'Myynti', 'decimal', 'measure', { format: { unit: 'currency', currency: 'EUR' } }),
  ],
};
const bar: ChartSpec = { id: 'b', datasetId: 'd', type: 'bar', x: { columnId: 'alue' }, y: [{ columnId: 'myynti', agg: 'sum' }], origin: 'rule' };
const rows = [
  { x: 'Helsinki', y0: 4_200_000 },
  { x: 'Tampere', y0: 1_900_000 },
  { x: '__blank__', y0: 800_000 },
];

describe.each(['fi', 'en'] as const)('toEChartsOption (%s)', (locale) => {
  const t = createT(locale).dynamic;
  it('bar chart snapshot', () => {
    expect(toEChartsOption(bar, rows, { locale, theme, dataset, t })).toMatchSnapshot();
  });
  it('line with series snapshot', () => {
    const spec: ChartSpec = { ...bar, type: 'line', x: { columnId: 'kk', timeGrain: 'month' }, series: { columnId: 'alue' } };
    const data = [
      { x: '2025-01-01', s: 'Helsinki', y0: 10 },
      { x: '2025-01-01', s: 'Oulu', y0: 4 },
      { x: '2025-02-01', s: 'Helsinki', y0: 12 },
      { x: '2025-02-01', s: '__other__', y0: 3 },
    ];
    const option = toEChartsOption(spec, data, { locale, theme, dataset, t });
    expect(option).toMatchSnapshot();
  });
});

describe('option details', () => {
  const t = createT('fi').dynamic;
  it('colour follows the entity, not the rank', () => {
    const spec: ChartSpec = { ...bar, type: 'stackedBar', series: { columnId: 'alue' }, x: { columnId: 'kk' } };
    const a = toEChartsOption(spec, [{ x: '2025-01-01', s: 'Oulu', y0: 1 }], { locale: 'fi', theme, dataset, t });
    const series = a.series as Array<{ itemStyle: { color: string } }>;
    expect(series[0].itemStyle.color).toBe(theme.palette[2]); // Oulu is third in the profile
  });
  it('labels blanks and uses Finnish month names', () => {
    const o = toEChartsOption({ ...bar, type: 'line', x: { columnId: 'kk', timeGrain: 'month' } }, [{ x: '2025-01-01', y0: 1 }], { locale: 'fi', theme, dataset, t });
    expect((o.xAxis as { data: string[] }).data).toEqual(['tammi 2025']);
    const b = toEChartsOption(bar, rows, { locale: 'fi', theme, dataset, t });
    expect((b.xAxis as { data: string[] }).data[2]).toBe('(tyhjä)');
  });
  it('dims unselected bars when cross-filtered', () => {
    const o = toEChartsOption(bar, rows, { locale: 'fi', theme, dataset, t, selected: 'Tampere' });
    const data = (o.series as Array<{ data: Array<{ itemStyle: { opacity: number } }> }>)[0].data;
    expect(data.map((d) => d.itemStyle.opacity)).toEqual([0.3, 1, 0.3]);
  });
  it('titles and summaries follow the language', () => {
    expect(chartTitle(bar, dataset as Dataset, createT('fi').dynamic)).toBe('Myynti / Alue');
    expect(chartTitle(bar, dataset as Dataset, createT('en').dynamic)).toBe('Myynti by Alue');
    expect(chartSummary(bar, rows, 'Myynti / Alue', { t, locale: 'fi', dataset })).toBe(
      'Pylväskaavio: Myynti / Alue. Suurin Helsinki 4,2 milj. €, pienin (tyhjä) 800 t. €.',
    );
  });
});

describe('format', () => {
  it('numbers by locale, compact axes, currency and percent', () => {
    expect(formatNumber(1234.56, 'fi')).toBe('1 235');
    expect(formatNumber(12.345, 'fi')).toBe('12,35');
    expect(formatNumber(1234.56, 'en')).toBe('1,235');
    expect(formatNumber(1_200_000, 'fi', { compact: true })).toBe('1,2 milj.');
    expect(formatNumber(1_200_000, 'en', { compact: true })).toBe('1.2M');
    expect(formatNumber(0.125, 'fi', { format: { unit: 'percent' } })).toBe('12,5 %');
    expect(formatNumber(99, 'en', { format: { unit: 'currency', currency: 'EUR' } })).toBe('€99');
  });
  it('dates by grain', () => {
    expect(formatDate('2025-01-01', 'fi', 'month')).toBe('tammi 2025');
    expect(formatDate('2025-01-01', 'en', 'month')).toBe('Jan 2025');
    expect(formatDate('2025-04-01', 'en', 'quarter')).toBe('Q2 2025');
    expect(formatDate('2025-12-31', 'fi')).toBe('31.12.2025');
    expect(formatDate('2025-12-31', 'en')).toBe('12/31/2025');
  });
  it('escapes HTML in tooltips', () => {
    expect(escapeHtml('<img onerror="x">')).toBe('&lt;img onerror=&quot;x&quot;&gt;');
  });
});
