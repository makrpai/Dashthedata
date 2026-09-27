'use client';

import Link from 'next/link';
import { ChevronsLeft, Plus, Wand2 } from 'lucide-react';
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
import { DashboardGrid } from './DashboardGrid';
import { FilterBar } from './FilterBar';
import { SuggestionPanel } from './SuggestionPanel';
import { toast } from '@/components/ui/sonner';
import { createAutoDashboard } from '@/lib/workspace/suggestions';
import { useTileActions } from './useTileActions';

export function DashboardView({ dashboardId }: { dashboardId: string }) {
  const t = useT();
  const dashboard = useProjectStore((s) => s.project?.dashboards.find((d) => d.id === dashboardId));
  const charts = useProjectStore((s) => s.project?.charts ?? EMPTY);
  const datasets = useProjectStore((s) => s.project?.datasets ?? EMPTY);
  const setBreadcrumb = useUiStore((s) => s.setBreadcrumbExtra);
  const [editing, setEditing] = useState<ChartSpec | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [autoBusy, setAutoBusy] = useState(false);
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
          <>
            <Button
              variant="soft"
              disabled={!visibleDatasets.length || autoBusy}
              onClick={async () => {
                setAutoBusy(true);
                try {
                  if (dashboard.tiles.length) {
                    useProjectStore.getState().updateDashboard(dashboardId, { tiles: [] });
                  }
                  await createAutoDashboard(dashboard.name);
                  toast.success(t('suggestions.autoDashboardDone'));
                } finally {
                  setAutoBusy(false);
                }
              }}
            >
              <Wand2 aria-hidden />
              {t('suggestions.autoDashboard')}
            </Button>
            <Button
              variant="primary"
              onClick={() => setEditing(newChart())}
              disabled={!visibleDatasets.length}
            >
              <Plus aria-hidden />
              {t('chart.newChart')}
            </Button>
            {!panelOpen && visibleDatasets.length > 0 && (
              <Button
                variant="soft"
                size="icon"
                aria-label={t('suggestions.expand')}
                onClick={() => setPanelOpen(true)}
              >
                <ChevronsLeft aria-hidden />
              </Button>
            )}
          </>
        }
      />
      <div
        className={panelOpen && visibleDatasets.length ? 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]' : ''}
      >
        <div className="min-w-0">
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
            <>
              <FilterBar dashboard={dashboard} />
              <DashboardGrid
                dashboard={dashboard}
                charts={charts}
                datasets={datasets}
                aiEnabled={false}
                onTileAction={(tile, chart, action, ctx, filters) => void onAction(tile, chart, action, ctx, filters)}
              />
            </>
          )}
        </div>
        {panelOpen && visibleDatasets.length > 0 && (
          <div className="hidden xl:block">
            <div className="sticky top-4">
              <SuggestionPanel dashboardId={dashboardId} onCollapse={() => setPanelOpen(false)} />
            </div>
          </div>
        )}
      </div>
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
