'use client';

import { newId } from '@/lib/util/id';
import { useProjectStore } from '@/store';
import type { ChartSpec, Dashboard, DashboardTile } from '@/types/domain';

export const GRID_COLS = 12;

/** Returns the id of the first dashboard, creating an empty one if needed. */
export function ensureDashboard(name: string): string | null {
  const store = useProjectStore.getState();
  if (!store.project) return null;
  if (store.project.dashboards[0]) return store.project.dashboards[0].id;
  const dashboard: Dashboard = { id: newId('db'), name, tiles: [], globalFilters: [] };
  store.addDashboard(dashboard);
  return dashboard.id;
}

/** First free position for a tile of size w×h in a 12-column grid ("+ Lisää", 13). */
export function firstFreeSpot(tiles: DashboardTile[], w: number, h: number): { x: number; y: number } {
  const occupied = (x: number, y: number) =>
    tiles.some((t) => x < t.layout.x + t.layout.w && x + w > t.layout.x && y < t.layout.y + t.layout.h && y + h > t.layout.y);
  for (let y = 0; y < 500; y++) {
    for (let x = 0; x + w <= GRID_COLS; x++) if (!occupied(x, y)) return { x, y };
  }
  return { x: 0, y: tiles.reduce((m, t) => Math.max(m, t.layout.y + t.layout.h), 0) };
}

export const defaultSize = (chart: ChartSpec) =>
  chart.type === 'kpi' ? { w: 3, h: 2 } : chart.type === 'table' ? { w: 12, h: 5 } : { w: 6, h: 4 };

/** Adds a chart (upserts the spec) as a tile on a dashboard. */
export function addChartToDashboard(dashboardId: string, chart: ChartSpec): string {
  const store = useProjectStore.getState();
  store.upsertChart(chart);
  const dashboard = store.project?.dashboards.find((d) => d.id === dashboardId);
  const size = defaultSize(chart);
  const spot = firstFreeSpot(dashboard?.tiles ?? [], size.w, size.h);
  const tile: DashboardTile = { id: newId('tile'), chartId: chart.id, layout: { ...spot, ...size } };
  store.updateDashboard(dashboardId, (d) => ({ ...d, tiles: [...d.tiles, tile] }));
  return tile.id;
}
