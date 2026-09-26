import type { ChartSpec, ChartType, ColumnProfile, Dataset } from '@/types/domain';

export const CHART_TYPES: ChartType[] = ['kpi', 'line', 'area', 'bar', 'hbar', 'stackedBar', 'scatter', 'histogram', 'donut', 'heatmap', 'table'];

export const isTime = (c?: ColumnProfile) => c?.role === 'time' || c?.type === 'date' || c?.type === 'datetime';
export const isMeasure = (c?: ColumnProfile) => c?.type === 'integer' || c?.type === 'decimal';
export const isDimension = (c?: ColumnProfile) => !!c && (c.role === 'dimension' || c.role === 'id' || c.role === 'text' || c.type === 'boolean' || c.type === 'text');

export function columnOf(dataset: Pick<Dataset, 'columns'>, id: string | undefined): ColumnProfile | undefined {
  return id ? dataset.columns.find((c) => c.id === id) : undefined;
}

export type SpecProblem =
  | 'needsMeasure'
  | 'needsTimeX'
  | 'needsDimensionX'
  | 'needsMeasureX'
  | 'tooManyMeasures'
  | 'needsSeries'
  | 'tooManyCategories'
  | 'missingColumn'
  | 'negativeValues';

/**
 * Checks a spec against the chart type requirements (11.1). Returns problems (empty = valid).
 * `distinct` of a column is taken from its profile.
 */
export function validateSpec(spec: ChartSpec, dataset: Pick<Dataset, 'columns'>): SpecProblem[] {
  const problems: SpecProblem[] = [];
  const x = columnOf(dataset, spec.x?.columnId);
  if (spec.x && !x) problems.push('missingColumn');
  if (spec.series && !columnOf(dataset, spec.series.columnId)) problems.push('missingColumn');
  const ys = spec.y.map((y) => (y.columnId === '*' ? null : columnOf(dataset, y.columnId)));
  if (ys.some((y) => y === undefined)) problems.push('missingColumn');
  const yMeasureOk = spec.y.length > 0 && spec.y.every((y, i) => y.columnId === '*' || y.agg === 'count' || y.agg === 'countDistinct' || isMeasure(ys[i] ?? undefined));
  switch (spec.type) {
    case 'kpi':
      if (spec.y.length !== 1 || !yMeasureOk) problems.push('needsMeasure');
      break;
    case 'line':
    case 'area':
      if (!isTime(x)) problems.push('needsTimeX');
      if (!yMeasureOk) problems.push('needsMeasure');
      if (spec.y.length > 3) problems.push('tooManyMeasures');
      break;
    case 'bar':
    case 'hbar':
      if (!x || isTime(x) === false && !isDimension(x)) problems.push('needsDimensionX');
      if (!yMeasureOk) problems.push('needsMeasure');
      if (spec.y.length > 2) problems.push('tooManyMeasures');
      break;
    case 'stackedBar':
      if (!x) problems.push('needsDimensionX');
      if (!spec.series) problems.push('needsSeries');
      if (!yMeasureOk || spec.y.length !== 1) problems.push('needsMeasure');
      break;
    case 'scatter':
      if (!isMeasure(x)) problems.push('needsMeasureX');
      if (spec.y.length !== 1 || !isMeasure(ys[0] ?? undefined)) problems.push('needsMeasure');
      break;
    case 'histogram':
      if (!isMeasure(x)) problems.push('needsMeasureX');
      break;
    case 'donut':
      if (!x || !isDimension(x)) problems.push('needsDimensionX');
      else if (x.stats.distinct > 6) problems.push('tooManyCategories');
      if (!yMeasureOk || spec.y.length !== 1) problems.push('needsMeasure');
      break;
    case 'heatmap':
      if (!x || !spec.series) problems.push('needsSeries');
      if (!yMeasureOk || spec.y.length !== 1) problems.push('needsMeasure');
      break;
    case 'table':
      break;
  }
  return [...new Set(problems)];
}

/** Chart types that fit the columns of a spec (used to grey out unsuitable types in the editor). */
export function suitableTypes(spec: ChartSpec, dataset: Pick<Dataset, 'columns'>): Record<ChartType, SpecProblem[]> {
  return Object.fromEntries(CHART_TYPES.map((type) => [type, validateSpec({ ...spec, type }, dataset)])) as Record<ChartType, SpecProblem[]>;
}
