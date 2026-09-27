'use client';

import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';
import type { ECharts } from 'echarts/core';
import { useCallback, useMemo } from 'react';
import type { ChartSelection } from '@/components/charts/ChartView';
import { effectiveFilters } from '@/lib/workspace/dashboardFilters';
import { categoryLabel } from '@/lib/charts/labels';
import { columnOf } from '@/lib/charts/spec';
import { useT } from '@/lib/i18n/useT';
import { setCrossFilter } from '@/lib/workspace/dashboardFilters';
import { useProjectStore } from '@/store';
import type { ChartSpec, Dashboard, DashboardTile, Dataset, FilterClause } from '@/types/domain';
import { ChartTile, type TileAction } from './ChartTile';
import { GRID_COLS } from '@/lib/workspace/dashboards';

const ROW_HEIGHT = 80;
const MARGIN: [number, number] = [20, 20];

/**
 * Raahattava, koon muutettava dashboard-ruudukko (13, 17.2 raahauksen aikana kevyempi varjo).
 * Cross-filter: klikkaus tuottaa CrossFilter-tilan, joka suodattaa muita ruutuja mutta ei
 * lähderuutua (se vain korostetaan).
 */
export function DashboardGrid({
  dashboard,
  charts,
  datasets,
  aiEnabled,
  onTileAction,
}: {
  dashboard: Dashboard;
  charts: ChartSpec[];
  datasets: Dataset[];
  aiEnabled: boolean;
  onTileAction: (
    tile: DashboardTile,
    chart: ChartSpec,
    action: TileAction,
    ctx: { instance: ECharts | null; asTable: boolean },
    filters: FilterClause[],
  ) => void;
}) {
  const t = useT();
  const { width, containerRef, mounted } = useContainerWidth();

  const items = useMemo(
    () => dashboard.tiles.map((tile) => ({ tile, chart: charts.find((c) => c.id === tile.chartId) })).filter((x): x is { tile: DashboardTile; chart: ChartSpec } => Boolean(x.chart)),
    [dashboard.tiles, charts],
  );

  const layout: Layout = useMemo(
    () => items.map(({ tile }) => ({ i: tile.id, x: tile.layout.x, y: tile.layout.y, w: tile.layout.w, h: tile.layout.h, minW: 2, minH: 2 })),
    [items],
  );

  const onLayoutChange = useCallback(
    (next: Layout) => {
      useProjectStore.getState().updateDashboard(dashboard.id, (d) => ({
        ...d,
        tiles: d.tiles.map((tile) => {
          const l = next.find((n) => n.i === tile.id);
          return l ? { ...tile, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : tile;
        }),
      }));
    },
    [dashboard.id],
  );

  const onSelect = useCallback(
    (tileId: string, chart: ChartSpec, sel: ChartSelection | null) => {
      if (!sel) {
        setCrossFilter(dashboard.id, undefined);
        return;
      }
      const dataset = datasets.find((d) => d.id === chart.datasetId);
      const column = dataset ? columnOf(dataset, sel.columnId) : undefined;
      const label = t('filterBar.crossFilterLabel', { column: column?.displayName ?? '', value: categoryLabel(sel.value, t.dynamic) });
      setCrossFilter(dashboard.id, {
        sourceTileId: tileId,
        clause: { datasetId: chart.datasetId, columnId: sel.columnId, op: 'eq', value: sel.value, timeGrain: sel.timeGrain },
        label,
      });
    },
    [dashboard.id, datasets, t],
  );

  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: GRID_COLS, rowHeight: ROW_HEIGHT, margin: MARGIN, containerPadding: [0, 0] }}
          dragConfig={{ enabled: true, handle: '.dtd-tile-drag' }}
          resizeConfig={{ enabled: true, handles: ['se'] }}
          onLayoutChange={onLayoutChange}
        >
          {items.map(({ tile, chart }) => {
            const dataset = datasets.find((d) => d.id === chart.datasetId);
            const filters = effectiveFilters(dashboard, tile.id);
            const crossSourceIsSelf = dashboard.crossFilter?.sourceTileId === tile.id;
            const selected = crossSourceIsSelf ? String(dashboard.crossFilter?.clause.value ?? '') : null;
            return (
              <div key={tile.id}>
                <ChartTile
                  chart={chart}
                  dataset={dataset}
                  filters={filters}
                  selected={selected}
                  onSelect={(sel) => onSelect(tile.id, chart, sel)}
                  onClearFilters={() => setCrossFilter(dashboard.id, undefined)}
                  onAction={(action, ctx) => onTileAction(tile, chart, action, ctx, filters)}
                  aiEnabled={aiEnabled}
                  dragHandleClass="dtd-tile-drag cursor-grab"
                  className="h-full"
                />
              </div>
            );
          })}
        </ReactGridLayout>
      )}
    </div>
  );
}
