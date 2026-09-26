import { newId } from '@/lib/util/id';
import type { ChartSpec, Dashboard, DashboardTile, Dataset, GlobalFilter } from '@/types/domain';

/**
 * Automatic dashboard (12.6), 12-column grid: KPI row (w3 h2), best trend (w12 h4), the next two
 * side by side (w6 h4), the rest in pairs, tables full width (w12 h5).
 */
export function autoLayout(charts: ChartSpec[], dataset: Dataset, name: string): Dashboard {
  const tiles: DashboardTile[] = [];
  let y = 0;
  const kpis = charts.filter((c) => c.type === 'kpi').slice(0, 4);
  kpis.forEach((c, i) => tiles.push({ id: newId('tile'), chartId: c.id, layout: { x: i * 3, y, w: 3, h: 2 } }));
  if (kpis.length) y += 2;
  const rest = charts.filter((c) => c.type !== 'kpi');
  const trendIdx = rest.findIndex((c) => (c.type === 'line' || c.type === 'area') && !c.series);
  const ordered = trendIdx >= 0 ? [rest[trendIdx], ...rest.filter((_, i) => i !== trendIdx)] : rest;
  let col = 0;
  ordered.forEach((c, i) => {
    if (c.type === 'table' || (i === 0 && trendIdx >= 0)) {
      if (col) {
        y += 4;
        col = 0;
      }
      const h = c.type === 'table' ? 5 : 4;
      tiles.push({ id: newId('tile'), chartId: c.id, layout: { x: 0, y, w: 12, h } });
      y += h;
      return;
    }
    tiles.push({ id: newId('tile'), chartId: c.id, layout: { x: col, y, w: 6, h: 4 } });
    col += 6;
    if (col >= 12) {
      col = 0;
      y += 4;
    }
  });
  const globalFilters: GlobalFilter[] = [];
  const time = dataset.columns.find((c) => c.role === 'time' && (c.type === 'date' || c.type === 'datetime'));
  if (time) globalFilters.push({ id: newId('gf'), columnRef: { datasetId: dataset.id, columnId: time.id }, kind: 'dateRange' });
  dataset.columns
    .filter((c) => c.role === 'dimension' && c.stats.distinct >= 2 && c.stats.distinct <= 30)
    .sort((a, b) => a.stats.distinct - b.stats.distinct)
    .slice(0, 3)
    .forEach((c) => globalFilters.push({ id: newId('gf'), columnRef: { datasetId: dataset.id, columnId: c.id }, kind: 'multiSelect' }));
  return { id: newId('db'), name, tiles, globalFilters };
}
