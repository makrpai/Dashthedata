'use client';

import type { ECharts } from 'echarts/core';
import { useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { tableColumnsFor } from '@/components/charts/ChartView';
import { buildQuery } from '@/lib/charts/queryBuilder';
import { chartTitle } from '@/lib/charts/labels';
import { downloadBlob, downloadDataUrl, rowsToCsv, safeFileName } from '@/lib/export/csv';
import { useT } from '@/lib/i18n/useT';
import { newId } from '@/lib/util/id';
import { GRID_COLS, addChartToDashboard } from '@/lib/workspace/dashboards';
import { ensureEngine } from '@/lib/workspace/engine';
import { useProjectStore } from '@/store';
import type { ChartSpec, DashboardTile, FilterClause } from '@/types/domain';
import type { TileAction } from './ChartTile';

export function moveTile(tile: DashboardTile, action: TileAction): DashboardTile['layout'] {
  const l = { ...tile.layout };
  switch (action) {
    case 'moveLeft':
      l.x = Math.max(0, l.x - 1);
      break;
    case 'moveRight':
      l.x = Math.min(GRID_COLS - l.w, l.x + 1);
      break;
    case 'moveUp':
      l.y = Math.max(0, l.y - 1);
      break;
    case 'moveDown':
      l.y += 1;
      break;
    case 'grow':
      l.w = Math.min(GRID_COLS - l.x, l.w + 1);
      l.h += 1;
      break;
    case 'shrink':
      l.w = Math.max(2, l.w - 1);
      l.h = Math.max(2, l.h - 1);
      break;
  }
  return l;
}

/** Actions from the tile menu (13): edit, duplicate, exports, keyboard moves, remove. */
export function useTileActions(dashboardId: string, onEdit: (chart: ChartSpec) => void, onExplain?: (tileId: string) => void) {
  const t = useT();
  return useCallback(
    async (tile: DashboardTile, chart: ChartSpec, action: TileAction, ctx: { instance: ECharts | null }, filters: FilterClause[]) => {
      const store = useProjectStore.getState();
      const dataset = store.project?.datasets.find((d) => d.id === chart.datasetId);
      const title = chartTitle(chart, dataset, t.dynamic);
      switch (action) {
        case 'edit':
          return onEdit(chart);
        case 'duplicate':
          addChartToDashboard(dashboardId, { ...chart, id: newId('ch'), origin: 'user' });
          return;
        case 'remove':
          store.updateDashboard(dashboardId, (d) => ({ ...d, tiles: d.tiles.filter((x) => x.id !== tile.id) }));
          if (!store.project?.dashboards.some((d) => d.id !== dashboardId && d.tiles.some((x) => x.chartId === chart.id))) store.removeChart(chart.id);
          return;
        case 'png': {
          if (!ctx.instance) return;
          const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
          downloadDataUrl(ctx.instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: surface }), `${safeFileName(title)}.png`);
          return;
        }
        case 'csv': {
          if (!dataset) return;
          const runner = await ensureEngine();
          const q = buildQuery(chart, dataset, filters);
          const rows = await runner.query(q.sql);
          const cols = tableColumnsFor(chart, dataset, rows, t).map((c) => ({ key: c.key, label: c.label, numeric: c.type === 'integer' || c.type === 'decimal' }));
          const out = chart.type === 'kpi' ? rowsToCsv([{ key: 'value', label: title, numeric: true }], rows, t.locale) : rowsToCsv(cols, rows, t.locale);
          downloadBlob(out, `${safeFileName(title)}.csv`, 'text/csv;charset=utf-8');
          return;
        }
        case 'explain':
          onExplain?.(tile.id);
          return;
        case 'toggleTable':
          return;
        default:
          store.updateDashboard(dashboardId, (d) => ({
            ...d,
            tiles: d.tiles.map((x) => (x.id === tile.id ? { ...x, layout: moveTile(x, action) } : x)),
          }));
          toast.message(t.dynamic(`chart.tile.${action}`));
      }
    },
    [dashboardId, onEdit, onExplain, t],
  );
}
