'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ChartEditor } from '@/components/charts/ChartEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ViewHeader } from '@/components/views/ViewHeader';
import { useT } from '@/lib/i18n/useT';
import { EMPTY } from '@/lib/util/empty';
import { newId } from '@/lib/util/id';
import { addChartToDashboard } from '@/lib/workspace/dashboards';
import { useProjectStore } from '@/store';
import { useUiStore } from '@/store/ui';
import type { ChartSpec } from '@/types/domain';
import { ChartTile } from './ChartTile';
import { useTileActions } from './useTileActions';

const ROW_HEIGHT = 80;

export function DashboardView({ dashboardId }: { dashboardId: string }) {
  const t = useT();
  const dashboard = useProjectStore((s) => s.project?.dashboards.find((d) => d.id === dashboardId));
  const charts = useProjectStore((s) => s.project?.charts ?? EMPTY);
  const datasets = useProjectStore((s) => s.project?.datasets ?? EMPTY);
  const setBreadcrumb = useUiStore((s) => s.setBreadcrumbExtra);
  const [editing, setEditing] = useState<ChartSpec | null>(null);
  const visibleDatasets = useMemo(() => datasets.filter((d) => d.columns.length > 0), [datasets]);
  const onAction = useTileActions(dashboardId, setEditing);

  useEffect(() => {
    setBreadcrumb(dashboard?.name ?? null);
    return () => setBreadcrumb(null);
  }, [dashboard?.name, setBreadcrumb]);

  if (!dashboard) return null;
  const newChart = (): ChartSpec => {
    const ds = visibleDatasets.find((d) => !d.hidden) ?? visibleDatasets[0];
    const x = ds?.columns.find((c) => c.role === 'dimension') ?? ds?.columns[0];
    const m = ds?.columns.find((c) => c.role === 'measure');
    return {
      id: newId('ch'),
      datasetId: ds?.id ?? '',
      type: 'bar',
      x: x ? { columnId: x.id } : undefined,
      y: [m ? { columnId: m.id, agg: 'sum' } : { columnId: '*', agg: 'count' }],
      origin: 'user',
    };
  };
  const sorted = [...dashboard.tiles].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);

  return (
    <>
      <ViewHeader
        title={dashboard.name}
        actions={
          <Button variant="primary" onClick={() => setEditing(newChart())} disabled={!visibleDatasets.length}>
            <Plus aria-hidden />
            {t('chart.newChart')}
          </Button>
        }
      />
      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            text={visibleDatasets.length ? t('views.dashboards.empty') : t('views.dashboards.noProject')}
            action={
              visibleDatasets.length ? undefined : (
                <Button asChild variant="primary">
                  <Link href="/workspace/data">{t('views.goToData')}</Link>
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12" style={{ gridAutoRows: `${ROW_HEIGHT}px` }}>
          {sorted.map((tile) => {
            const chart = charts.find((c) => c.id === tile.chartId);
            if (!chart) return null;
            const dataset = datasets.find((d) => d.id === chart.datasetId);
            return (
              <div
                key={tile.id}
                className="min-w-0"
                style={{ gridColumn: `${tile.layout.x + 1} / span ${tile.layout.w}`, gridRow: `${tile.layout.y + 1} / span ${tile.layout.h}` }}
              >
                <ChartTile
                  chart={chart}
                  dataset={dataset}
                  filters={[]}
                  onAction={(action, ctx) => void onAction(tile, chart, action, ctx, [])}
                />
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <ChartEditor
          open
          initial={editing}
          datasets={visibleDatasets}
          onClose={() => setEditing(null)}
          onSave={(spec) => {
            const exists = charts.some((c) => c.id === spec.id);
            if (exists) useProjectStore.getState().upsertChart(spec);
            else addChartToDashboard(dashboardId, spec);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
