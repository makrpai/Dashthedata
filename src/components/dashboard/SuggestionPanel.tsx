'use client';

import { ChevronsRight, Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ChartView } from '@/components/charts/ChartView';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { chartTitle, resolveReasonParams } from '@/lib/charts/labels';
import { useT } from '@/lib/i18n/useT';
import { newId } from '@/lib/util/id';
import { addChartToDashboard } from '@/lib/workspace/dashboards';
import { loadSuggestions } from '@/lib/workspace/suggestions';
import { useProjectStore } from '@/store';
import { useSuggestionStore } from '@/store/suggestions';
import type { ChartSpec, Dataset } from '@/types/domain';

const same = (a: ChartSpec, b: ChartSpec) =>
  a.datasetId === b.datasetId &&
  a.type === b.type &&
  a.x?.columnId === b.x?.columnId &&
  a.series?.columnId === b.series?.columnId &&
  a.y.map((y) => `${y.columnId}${y.agg}`).join() === b.y.map((y) => `${y.columnId}${y.agg}`).join();

function SuggestionCard({ spec, dataset, onAdd }: { spec: ChartSpec; dataset: Dataset; onAdd: () => void }) {
  const t = useT();
  const title = chartTitle(spec, dataset, t.dynamic);
  const reason = spec.reason ? t.dynamic(spec.reason.key, resolveReasonParams(spec.reason.params, dataset, t.locale, t.dynamic)) : '';
  return (
    <li className="nm-flat flex flex-col gap-2 rounded-[var(--radius-control)] p-3">
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
        <p className="min-w-0 flex-1 text-[13px] font-semibold">{title}</p>
        <Button size="sm" variant="soft" onClick={onAdd} aria-label={`${t('suggestions.add')}: ${title}`}>
          <Plus aria-hidden />
          {t('suggestions.add')}
        </Button>
      </div>
      <div className="h-28" aria-hidden>
        <ChartView spec={spec} dataset={dataset} filters={[]} />
      </div>
      {reason && <p className="text-[12px] text-fg-2">{reason}</p>}
    </li>
  );
}

/** Collapsible suggestions column on the dashboard (13). */
export function SuggestionPanel({ dashboardId, onCollapse }: { dashboardId: string; onCollapse: () => void }) {
  const t = useT();
  const datasets = useProjectStore((s) => s.project?.datasets);
  const charts = useProjectStore((s) => s.project?.charts);
  const tiles = useProjectStore((s) => s.project?.dashboards.find((d) => d.id === dashboardId)?.tiles);
  const visible = (datasets ?? []).filter((d) => !d.hidden && d.columns.length);
  const [datasetId, setDatasetId] = useState<string | undefined>(undefined);
  const dataset = visible.find((d) => d.id === datasetId) ?? visible[0];
  const entry = useSuggestionStore((s) => (dataset ? s.byDataset[dataset.id] : undefined));
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (dataset && (!entry || entry.version !== dataset.version)) void loadSuggestions(dataset.id);
  }, [dataset, entry]);

  if (!dataset) return null;
  const onBoard = (tiles ?? []).map((tile) => charts?.find((c) => c.id === tile.chartId)).filter((c): c is ChartSpec => Boolean(c));
  const fresh = (list: ChartSpec[]) => list.filter((s) => !onBoard.some((c) => same(c, s)));
  const top = fresh(entry?.top ?? []);
  const more = fresh(entry?.more ?? []);
  const add = (spec: ChartSpec) => {
    addChartToDashboard(dashboardId, { ...spec, id: newId('ch') });
    toast.success(t('suggestions.added'));
  };
  return (
    <aside className="nm-raised flex max-h-[calc(100vh-7rem)] flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] p-4" aria-label={t('suggestions.title')}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[17.5px] font-bold">{t('suggestions.title')}</h2>
        <Button size="iconSm" variant="ghost" aria-label={t('suggestions.collapse')} onClick={onCollapse}>
          <ChevronsRight aria-hidden />
        </Button>
      </div>
      {visible.length > 1 && (
        <Select value={dataset.id} onValueChange={setDatasetId}>
          <SelectTrigger aria-label={t('suggestions.forDataset')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visible.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {entry?.loading && !top.length ? (
          <p className="flex items-center gap-2 text-[13px] text-fg-2" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('suggestions.computing')}
          </p>
        ) : top.length === 0 && more.length === 0 ? (
          <p className="text-[13px] text-fg-2">{t('suggestions.none')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {top.map((s) => (
              <SuggestionCard key={s.id} spec={s} dataset={dataset} onAdd={() => add(s)} />
            ))}
            {more.length > 0 &&
              (showMore ? (
                more.map((s) => <SuggestionCard key={s.id} spec={s} dataset={dataset} onAdd={() => add(s)} />)
              ) : (
                <li>
                  <Button variant="ghost" size="sm" onClick={() => setShowMore(true)}>
                    {t('suggestions.more')} ({more.length})
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
