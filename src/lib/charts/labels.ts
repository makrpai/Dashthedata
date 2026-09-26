import type { TDynamic } from '@/lib/i18n';
import type { ChartSpec, ColumnProfile, Dataset, Locale, TimeGrain } from '@/types/domain';
import { formatDate, formatNumber } from './format';
import { BLANK, OTHER } from './queryBuilder';
import { columnOf } from './spec';

/** Auto-title params store column ids as "col:<id>" so renames follow; resolved at render time. */
export function resolveParam(value: string, dataset: Pick<Dataset, 'columns' | 'name'>): string {
  if (value.startsWith('col:')) return columnOf(dataset, value.slice(4))?.displayName ?? value.slice(4);
  if (value === 'dataset:name') return dataset.name;
  return value;
}

export function measureLabel(y: ChartSpec['y'][number], dataset: Pick<Dataset, 'columns'>, t: TDynamic): string {
  if (y.label) return y.label;
  if (y.columnId === '*') return t('chart.rowCount');
  const name = columnOf(dataset, y.columnId)?.displayName ?? y.columnId;
  return y.agg === 'sum' ? name : `${name} (${t(`chart.aggShort.${y.agg}`)})`;
}

/** User title > automatic i18n title (follows the UI language, 12.5). */
export function chartTitle(spec: ChartSpec, dataset: Pick<Dataset, 'columns' | 'name'> | undefined, t: TDynamic): string {
  if (spec.title) return spec.title;
  if (!dataset) return '';
  if (spec.autoTitle) {
    const params = Object.fromEntries(Object.entries(spec.autoTitle.params).map(([k, v]) => [k, resolveParam(v, dataset)]));
    return t(spec.autoTitle.key, params);
  }
  const measure = spec.y[0] ? measureLabel(spec.y[0], dataset, t) : '';
  const x = columnOf(dataset, spec.x?.columnId)?.displayName ?? '';
  const s = columnOf(dataset, spec.series?.columnId)?.displayName ?? '';
  switch (spec.type) {
    case 'kpi':
      return t('chart.title.kpi', { measure });
    case 'line':
    case 'area':
      return s ? t('chart.title.overTimeBy', { measure, series: s }) : t('chart.title.overTime', { measure });
    case 'donut':
      return t('chart.title.shareBy', { measure, dimension: x });
    case 'histogram':
      return t('chart.title.distribution', { measure: x });
    case 'scatter':
      return t('chart.title.relation', { a: x, b: measure });
    case 'heatmap':
      return t('chart.title.heatmap', { measure, dimension: x, series: s });
    case 'table':
      return x ? t('chart.title.topList', { measure, dimension: x }) : t('chart.title.table', { dataset: dataset.name });
    default:
      return t('chart.title.byDimension', { measure, dimension: x });
  }
}

export function categoryLabel(value: unknown, t: TDynamic): string {
  if (value === OTHER) return t('common.other');
  if (value === BLANK || value === null || value === undefined) return t('common.blank');
  if (value === true || value === 'true') return t('common.yes');
  if (value === false || value === 'false') return t('common.no');
  return String(value);
}

/** Stable colour index per category value: follows the entity, not its rank in a filtered result. */
export function entityColorIndex(value: string, column: ColumnProfile | undefined, paletteSize: number): number {
  const top = column?.stats.top?.map((x) => x.value) ?? [];
  const i = top.indexOf(value);
  if (i >= 0 && i < paletteSize) return i;
  let h = 0;
  for (let k = 0; k < value.length; k++) h = (h * 31 + value.charCodeAt(k)) >>> 0;
  return h % paletteSize;
}

/**
 * Resolves stored reason params at render time so they follow the UI language:
 * col:<id> → column name, date:<grain>:<iso> → formatted period, num:col:<id>:<n> → number in the
 * column's format, cat:<value> → category label.
 */
export function resolveReasonParams(
  params: Record<string, string | number>,
  dataset: Pick<Dataset, 'columns' | 'name'> | undefined,
  locale: Locale,
  t: TDynamic,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v !== 'string') {
      out[k] = v;
      continue;
    }
    if (v.startsWith('num:col:')) {
      const rest = v.slice(8);
      const i = rest.lastIndexOf(':');
      const c = dataset ? columnOf(dataset, rest.slice(0, i)) : undefined;
      out[k] = formatNumber(Number(rest.slice(i + 1)), locale, { format: c?.format, compact: Math.abs(Number(rest.slice(i + 1))) >= 10000 });
    } else if (v.startsWith('date:')) {
      const [, grain, iso] = v.split(':');
      out[k] = formatDate(iso, locale, grain as TimeGrain);
    } else if (v.startsWith('cat:')) {
      out[k] = categoryLabel(v.slice(4), t);
    } else if (v.startsWith('col:') && dataset) {
      out[k] = resolveParam(v, dataset);
    } else {
      out[k] = v;
    }
  }
  return out;
}
