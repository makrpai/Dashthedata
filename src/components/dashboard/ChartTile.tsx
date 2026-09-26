'use client';

import type { ECharts } from 'echarts/core';
import { Info, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { ChartView, type ChartSelection } from '@/components/charts/ChartView';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { chartTitle, resolveReasonParams } from '@/lib/charts/labels';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/util/cn';
import type { ChartSpec, Dataset, FilterClause } from '@/types/domain';

export type TileAction =
  | 'edit'
  | 'duplicate'
  | 'toggleTable'
  | 'png'
  | 'csv'
  | 'explain'
  | 'remove'
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'grow'
  | 'shrink';

/** Dashboard tile (13): raised card with title, "Why this?" and a menu. */
export function ChartTile({
  chart,
  dataset,
  filters,
  selected,
  onSelect,
  onClearFilters,
  onAction,
  aiEnabled = false,
  dragHandleClass,
  enabled = true,
  className,
  headerExtra,
}: {
  chart: ChartSpec;
  dataset: Dataset | undefined;
  filters: FilterClause[];
  selected?: string | null;
  onSelect?: (sel: ChartSelection | null) => void;
  onClearFilters?: () => void;
  onAction: (action: TileAction, ctx: { instance: ECharts | null; asTable: boolean }) => void;
  aiEnabled?: boolean;
  dragHandleClass?: string;
  enabled?: boolean;
  className?: string;
  headerExtra?: React.ReactNode;
}) {
  const t = useT();
  const [asTable, setAsTable] = useState(false);
  const instance = useRef<ECharts | null>(null);
  const title = chartTitle(chart, dataset, t.dynamic);
  const reason = chart.aiReason ?? (chart.reason ? t.dynamic(chart.reason.key, resolveReasonParams(chart.reason.params, dataset, t.locale, t.dynamic)) : null);
  const act = (a: TileAction) => {
    if (a === 'toggleTable') setAsTable((v) => !v);
    onAction(a, { instance: instance.current, asTable });
  };
  return (
    <article className={cn('nm-raised flex h-full min-h-0 flex-col rounded-[var(--radius-card)] p-4', className)} aria-label={title}>
      <header className={cn('mb-2 flex items-start gap-2', dragHandleClass)}>
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold" title={title}>
          {title}
        </h3>
        {chart.origin === 'ai' && (
          <Badge variant="accent" className="shrink-0">
            {chart.aiProvider === 'local' ? t('chart.tile.aiLocal') : t('chart.tile.aiClaude')}
          </Badge>
        )}
        {headerExtra}
        {reason && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="iconSm" className="size-7 shrink-0" aria-label={t('chart.tile.why')}>
                <Info aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
                <span aria-hidden className="size-2 rounded-full bg-accent" />
                {t('chart.tile.why')}
              </p>
              <p className="text-[13px] text-fg-2">{reason}</p>
            </PopoverContent>
          </Popover>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="iconSm" className="size-7 shrink-0" aria-label={`${t('chart.tile.menu')}: ${title}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => act('edit')}>{t('chart.tile.edit')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act('duplicate')}>{t('chart.tile.duplicate')}</DropdownMenuItem>
            {chart.type !== 'kpi' && chart.type !== 'table' && (
              <DropdownMenuItem onSelect={() => act('toggleTable')}>{asTable ? t('chart.tile.showChart') : t('chart.tile.showTable')}</DropdownMenuItem>
            )}
            {chart.type !== 'kpi' && chart.type !== 'table' && !asTable && <DropdownMenuItem onSelect={() => act('png')}>{t('chart.tile.downloadPng')}</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => act('csv')}>{t('chart.tile.downloadCsv')}</DropdownMenuItem>
            {aiEnabled && <DropdownMenuItem onSelect={() => act('explain')}>{t('chart.tile.explain')}</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => act('moveLeft')}>{t('chart.tile.moveLeft')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act('moveRight')}>{t('chart.tile.moveRight')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act('moveUp')}>{t('chart.tile.moveUp')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act('moveDown')}>{t('chart.tile.moveDown')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act('grow')}>{t('chart.tile.grow')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act('shrink')}>{t('chart.tile.shrink')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => act('remove')}>
              {t('chart.tile.remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="min-h-0 flex-1">
        <ChartView
          spec={chart}
          dataset={dataset}
          filters={filters}
          selected={selected}
          onSelect={onSelect}
          onClearFilters={onClearFilters}
          asTable={asTable}
          enabled={enabled}
          onInstance={(i) => {
            instance.current = i;
          }}
        />
      </div>
    </article>
  );
}
