import type { ChartSpec } from '@/types/domain';

/** The measure a chart is about (histograms bin their x column). */
const measureOf = (c: ChartSpec) => (c.type === 'histogram' ? c.x?.columnId : c.y[0]?.columnId) ?? '*';

const combo = (s: ChartSpec) =>
  [s.type, s.x?.columnId ?? '', s.series?.columnId ?? '', ...s.y.map((y) => `${y.columnId}:${y.agg}`)].join('|');

/**
 * Greedy diverse selection (12.4): highest score first; a candidate is taken only if there are fewer
 * than 2 of its type (KPI < 4), fewer than 3 using its measure, and no identical column combination.
 */
export function diversify(candidates: ChartSpec[], max = 8): { top: ChartSpec[]; more: ChartSpec[] } {
  // With only one or two measures the "< 3 per measure" rule would leave the dashboard nearly empty,
  // so the cap grows to share the slots between the available measures.
  const measureIds = new Set(candidates.filter((c) => c.type !== 'kpi').map(measureOf).filter((m) => m !== '*'));
  const perMeasure = measureIds.size <= 2 ? Math.ceil(max / Math.max(1, measureIds.size)) : 3;
  const sorted = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top: ChartSpec[] = [];
  const more: ChartSpec[] = [];
  const types = new Map<string, number>();
  const measures = new Map<string, number>();
  const combos = new Set<string>();
  let nonKpi = 0;
  for (const c of sorted) {
    const key = combo(c);
    if (combos.has(key)) continue;
    const base = c.type === 'hbar' ? 'bar' : c.type === 'area' ? 'line' : c.type;
    // Trends split by a category are their own kind, so the overall trend does not crowd them out.
    const typeKey = base === 'line' && c.series ? 'lineSeries' : base;
    const typeCount = types.get(typeKey) ?? 0;
    const measure = measureOf(c);
    const measureCount = measures.get(measure) ?? 0;
    const typeOk = c.type === 'kpi' ? typeCount < 4 : typeCount < 2;
    const measureOk = c.type === 'kpi' || measureCount < perMeasure;
    const room = c.type === 'kpi' || nonKpi < max;
    if (typeOk && measureOk && room) {
      top.push(c);
      combos.add(key);
      types.set(typeKey, typeCount + 1);
      if (c.type !== 'kpi') {
        measures.set(measure, measureCount + 1);
        nonKpi++;
      }
    } else {
      more.push(c);
      combos.add(key);
    }
  }
  return { top, more };
}
