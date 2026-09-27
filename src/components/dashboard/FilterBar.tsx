'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { categoryLabel } from '@/lib/charts/labels';
import { formatDate } from '@/lib/charts/format';
import { useT } from '@/lib/i18n/useT';
import { clearAllFilters, removeGlobalFilter, setCrossFilter, setGlobalFilterValue } from '@/lib/workspace/dashboardFilters';
import { useProjectStore } from '@/store';
import type { Dashboard, Dataset, GlobalFilter } from '@/types/domain';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function quickRanges(): Record<string, [string, string]> {
  const now = new Date();
  const startOfMonth = (y: number, m: number) => new Date(y, m, 1);
  const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0);
  const thisMonth: [string, string] = [iso(startOfMonth(now.getFullYear(), now.getMonth())), iso(endOfMonth(now.getFullYear(), now.getMonth()))];
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth: [string, string] = [iso(startOfMonth(lastMonthDate.getFullYear(), lastMonthDate.getMonth())), iso(endOfMonth(lastMonthDate.getFullYear(), lastMonthDate.getMonth()))];
  const thisYear: [string, string] = [iso(new Date(now.getFullYear(), 0, 1)), iso(new Date(now.getFullYear(), 11, 31))];
  const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const last12: [string, string] = [iso(twelveAgo), iso(endOfMonth(now.getFullYear(), now.getMonth()))];
  return { thisMonth, lastMonth, thisYear, last12Months: last12 };
}

function DateRangeFilter({ dashboardId, filter, column }: { dashboardId: string; filter: GlobalFilter; column: { displayName: string } | undefined }) {
  const t = useT();
  const value = filter.value as [string, string] | undefined;
  const ranges = quickRanges();
  const active = (key: keyof typeof ranges) => value && value[0] === ranges[key][0] && value[1] === ranges[key][1];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="soft" size="sm" className="gap-1.5">
          {column?.displayName ?? ''}
          {value ? (
            <span className="tabular text-fg-2">
              {formatDate(value[0], t.locale)}–{formatDate(value[1], t.locale)}
            </span>
          ) : (
            <span className="text-fg-2">{t('filterBar.all')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto flex-col gap-1.5">
        {(Object.keys(ranges) as Array<keyof typeof ranges>).map((key) => (
          <Button
            key={key}
            variant={active(key) ? 'primary' : 'ghost'}
            size="sm"
            className="justify-start"
            onClick={() => setGlobalFilterValue(dashboardId, filter.id, ranges[key])}
          >
            {t.dynamic(`filterBar.${key}`)}
          </Button>
        ))}
        <Button variant={!value ? 'primary' : 'ghost'} size="sm" className="justify-start" onClick={() => setGlobalFilterValue(dashboardId, filter.id, undefined)}>
          {t('filterBar.all')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectFilter({ dashboardId, filter, column }: { dashboardId: string; filter: GlobalFilter; column: Dataset['columns'][number] | undefined }) {
  const t = useT();
  const selected = new Set((filter.value as string[] | undefined) ?? []);
  const options = column?.stats.top?.map((v) => v.value) ?? [];
  const [query, setQuery] = useState('');
  const filtered = query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options;
  const toggle = (value: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(value);
    else next.delete(value);
    setGlobalFilterValue(dashboardId, filter.id, next.size ? [...next] : undefined);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="soft" size="sm">
          {column?.displayName ?? ''}
          {selected.size > 0 ? (
            <Badge variant="accent" className="ml-1">
              {t('filterBar.selected', { count: selected.size })}
            </Badge>
          ) : (
            <span className="ml-1 text-fg-2">{t('filterBar.all')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('filterBar.search')} aria-label={t('filterBar.search')} />
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {filtered.map((value) => {
            const id = `${filter.id}-${value}`;
            return (
              <label key={value} htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-1 py-1 hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)]">
                <Checkbox id={id} checked={selected.has(value)} onCheckedChange={(v) => toggle(value, v === true)} />
                <span className="truncate text-[13px]">{categoryLabel(value, t.dynamic)}</span>
              </label>
            );
          })}
        </div>
        {selected.size > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setGlobalFilterValue(dashboardId, filter.id, undefined)}>
            {t('filterBar.all')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NumberRangeInputs({
  dashboardId,
  filter,
  value,
}: {
  dashboardId: string;
  filter: GlobalFilter;
  value: [number | undefined, number | undefined] | undefined;
}) {
  const t = useT();
  const [min, setMin] = useState(value?.[0]?.toString() ?? '');
  const [max, setMax] = useState(value?.[1]?.toString() ?? '');
  return (
    <>
      <div className="flex items-center gap-2">
        <Input type="number" aria-label={t('filterBar.min')} placeholder={t('filterBar.min')} value={min} onChange={(e) => setMin(e.target.value)} />
        <span aria-hidden>–</span>
        <Input type="number" aria-label={t('filterBar.max')} placeholder={t('filterBar.max')} value={max} onChange={(e) => setMax(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        {value && (
          <Button variant="ghost" size="sm" onClick={() => setGlobalFilterValue(dashboardId, filter.id, undefined)}>
            {t('filterBar.all')}
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            setGlobalFilterValue(
              dashboardId,
              filter.id,
              !min && !max ? undefined : [min ? Number(min) : '', max ? Number(max) : ''],
            )
          }
        >
          {t('filterBar.apply')}
        </Button>
      </div>
    </>
  );
}

function NumberRangeFilter({ dashboardId, filter, column }: { dashboardId: string; filter: GlobalFilter; column: { displayName: string } | undefined }) {
  const t = useT();
  const value = filter.value as [number | undefined, number | undefined] | undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="soft" size="sm">
          {column?.displayName ?? ''}
          {value ? (
            <span className="tabular text-fg-2">
              {value[0] ?? ''}–{value[1] ?? ''}
            </span>
          ) : (
            <span className="text-fg-2">{t('filterBar.all')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-56 flex-col gap-2">
        <NumberRangeInputs dashboardId={dashboardId} filter={filter} value={value} />
      </PopoverContent>
    </Popover>
  );
}

/** Global filters plus the active cross-filter chip (13). Esc clears the cross-filter. */
export function FilterBar({ dashboard }: { dashboard: Dashboard }) {
  const t = useT();
  const datasets = useProjectStore((s) => s.project?.datasets ?? []);
  const hasActive = dashboard.globalFilters.some((f) => f.value !== undefined) || Boolean(dashboard.crossFilter);

  useEffect(() => {
    if (!dashboard.crossFilter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCrossFilter(dashboard.id, undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dashboard.id, dashboard.crossFilter]);

  if (!dashboard.globalFilters.length && !dashboard.crossFilter) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label={t('chart.editor.filters')}>
      {dashboard.globalFilters.map((f) => {
        const dataset = datasets.find((d) => d.id === f.columnRef.datasetId);
        const column = dataset?.columns.find((c) => c.id === f.columnRef.columnId);
        return (
          <div key={f.id} className="group flex items-center">
            {f.kind === 'dateRange' && <DateRangeFilter dashboardId={dashboard.id} filter={f} column={column} />}
            {f.kind === 'multiSelect' && <MultiSelectFilter dashboardId={dashboard.id} filter={f} column={column} />}
            {f.kind === 'numberRange' && <NumberRangeFilter dashboardId={dashboard.id} filter={f} column={column} />}
            <Button
              variant="ghost"
              size="iconSm"
              className="ml-0.5 opacity-0 group-hover:opacity-100"
              aria-label={`${t('filterBar.clearOne')}: ${column?.displayName ?? ''}`}
              onClick={() => removeGlobalFilter(dashboard.id, f.id)}
            >
              <X aria-hidden />
            </Button>
          </div>
        );
      })}
      {dashboard.crossFilter && (
        <Badge variant="accent" className="gap-1.5 py-1 pr-1 pl-2.5 text-[13px]">
          {dashboard.crossFilter.label ?? t('filterBar.crossFilterLabel', { column: dashboard.crossFilter.clause.columnId, value: String(dashboard.crossFilter.clause.value ?? '') })}
          <button
            type="button"
            className="rounded-full p-0.5 hover:bg-[color-mix(in_srgb,var(--accent-fg)_15%,transparent)]"
            aria-label={t('filterBar.clearCross')}
            onClick={() => setCrossFilter(dashboard.id, undefined)}
          >
            <X className="size-3" aria-hidden />
          </button>
        </Badge>
      )}
      {hasActive && (
        <Button variant="ghost" size="sm" onClick={() => clearAllFilters(dashboard.id)}>
          {t('chart.clearFilters')}
        </Button>
      )}
    </div>
  );
}
