'use client';

import type { ECharts } from 'echarts/core';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { chartSummary, toEChartsOption } from '@/lib/charts/echartsOption';
import { formatNumber } from '@/lib/charts/format';
import { categoryLabel, chartTitle, measureLabel } from '@/lib/charts/labels';
import { columnOf, isTime } from '@/lib/charts/spec';
import type { Row } from '@/lib/duckdb/types';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useT } from '@/lib/i18n/useT';
import { correlation } from '@/lib/util/stats';
import type { ChartSpec, Dataset, FilterClause, TimeGrain } from '@/types/domain';
import { EChart, type EChartClick } from './EChart';
import { KpiView } from './KpiView';
import { TableView, type TableColumn } from './TableView';
import { useChartData } from './useChartData';
import { useChartTheme } from './useChartTheme';

export interface ChartSelection {
  /** Which column the clicked value belongs to. */
  columnId: string;
  value: string;
  /** Time grain of the axis when the value is a period start. */
  timeGrain?: TimeGrain;
}

/** Table columns for a chart's result rows ("show as table"). */
export function tableColumnsFor(spec: ChartSpec, dataset: Dataset, rows: Row[], t: ReturnType<typeof useT>): TableColumn[] {
  const x = columnOf(dataset, spec.x?.columnId);
  const s = columnOf(dataset, spec.series?.columnId);
  if (spec.type === 'table' && !x) {
    const ids = spec.columns?.length ? spec.columns : dataset.columns.map((c) => c.id);
    return ids.map((id) => columnOf(dataset, id)).filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => ({ key: c.sqlName, label: c.displayName, type: c.type, format: c.format }));
  }
  const cols: TableColumn[] = [];
  if (spec.type === 'histogram') {
    cols.push({ key: 'from', label: `${x?.displayName ?? ''} ≥`, type: 'decimal', format: x?.format }, { key: 'to', label: '<', type: 'decimal', format: x?.format });
    cols.push({ key: 'y0', label: t('chart.rowCount'), type: 'integer' });
    return cols;
  }
  if (x) {
    const time = isTime(x) && (x.type === 'date' || x.type === 'datetime');
    cols.push({
      key: 'x',
      label: x.displayName,
      type: spec.type === 'scatter' ? x.type : time ? 'date' : 'text',
      format: spec.type === 'scatter' ? x.format : { ...x.format, timeGrainHint: spec.x?.timeGrain ?? x.format?.timeGrainHint },
      render: spec.type === 'scatter' || time ? undefined : (v) => categoryLabel(v, t.dynamic),
    });
  }
  if (s) cols.push({ key: 's', label: s.displayName, type: 'text', render: (v) => categoryLabel(v, t.dynamic) });
  spec.y.forEach((y, i) => {
    const c = y.columnId === '*' ? undefined : columnOf(dataset, y.columnId);
    cols.push({ key: `y${i}`, label: measureLabel(y, dataset, t.dynamic), type: 'decimal', format: y.agg === 'count' || y.agg === 'countDistinct' ? undefined : c?.format });
  });
  void rows;
  return cols;
}

/**
 * Renders one chart: KPI tile, table or ECharts, with empty/loading/error states and the notes
 * required by 11.2 ("showing the 30 largest", sample size, correlation).
 */
export function ChartView({
  spec,
  dataset,
  filters,
  selected,
  onSelect,
  onClearFilters,
  asTable = false,
  enabled = true,
  onInstance,
}: {
  spec: ChartSpec;
  dataset: Dataset | undefined;
  filters: FilterClause[];
  selected?: string | null;
  onSelect?: (sel: ChartSelection | null) => void;
  onClearFilters?: () => void;
  asTable?: boolean;
  enabled?: boolean;
  onInstance?: (chart: ECharts) => void;
}) {
  const t = useT();
  const data = useChartData(spec, dataset, filters, enabled);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const title = chartTitle(spec, dataset, t.dynamic);
  const theme = useChartTheme();
  const option = useMemo(() => {
    if (!dataset || spec.type === 'kpi' || spec.type === 'table' || !data.rows.length) return null;
    const aria = chartSummary(spec, data.rows, title, { t: t.dynamic, locale: t.locale, dataset });
    return { aria, option: toEChartsOption(spec, data.rows, { locale: t.locale, theme, dataset, t: t.dynamic, selected, reducedMotion, ariaLabel: aria }) };
  }, [dataset, spec, data.rows, title, t, theme, selected, reducedMotion]);

  if (!dataset) return null;
  if (data.error) {
    return <p className="p-3 text-[13px] text-danger">{t('chart.error', { message: data.error })}</p>;
  }
  if (data.loading) {
    return (
      <div className="flex h-full items-center justify-center text-fg-2" role="status" aria-label={t('chart.loading')}>
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    );
  }
  if (spec.type === 'kpi') {
    const c = spec.y[0] && spec.y[0].columnId !== '*' ? columnOf(dataset, spec.y[0].columnId) : undefined;
    return <KpiView row={data.rows[0]} spark={data.spark} label={spec.y[0] ? measureLabel(spec.y[0], dataset, t.dynamic) : ''} format={spec.y[0]?.agg === 'count' ? undefined : c?.format} />;
  }
  if (!data.rows.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-[13px] text-fg-2">{t('chart.empty')}</p>
        {onClearFilters && filters.length > 0 && (
          <Button size="sm" variant="soft" onClick={onClearFilters}>
            {t('chart.clearFilters')}
          </Button>
        )}
      </div>
    );
  }
  const notes: string[] = [];
  if (data.truncated && data.query?.limit) notes.push(t('chart.showingTop', { count: data.query.limit }));
  if (spec.type === 'scatter') {
    const total = Number(data.rows[0]?.total ?? data.rows.length);
    if (total > data.rows.length) notes.push(t('chart.sampled', { count: formatNumber(data.rows.length, t.locale), total: formatNumber(total, t.locale) }));
    const r = correlation(data.rows.map((d) => d.x as number), data.rows.map((d) => d.y0 as number));
    notes.push(t('chart.correlation', { r: formatNumber(r, t.locale, { maximumFractionDigits: 2 }) }));
  }
  const handleClick = (e: EChartClick) => {
    if (!onSelect) return;
    const x = columnOf(dataset, spec.x?.columnId);
    const s = columnOf(dataset, spec.series?.columnId);
    let columnId: string | undefined;
    let value: unknown;
    if (spec.type === 'donut') {
      columnId = x?.id;
      value = (e as unknown as { data?: { raw?: string } }).data?.raw;
    } else if (spec.type === 'heatmap') {
      const v = e.value as [number, number, number];
      const xs = [...new Set(data.rows.map((r) => String(r.x)))];
      columnId = x?.id;
      value = xs[v[0]];
    } else if (s && e.seriesName !== undefined) {
      const keys = [...new Set(data.rows.map((r) => String(r.s)))];
      columnId = s.id;
      value = keys.find((k) => categoryLabel(k, t.dynamic) === e.seriesName);
    } else if (spec.type !== 'scatter' && spec.type !== 'histogram') {
      const xs = [...new Set(data.rows.map((r) => String(r.x)))];
      columnId = x?.id;
      value = xs[e.dataIndex];
    }
    if (!columnId || value === undefined || value === '__other__') return;
    const timeGrain: TimeGrain | undefined = x && columnId === x.id && (x.type === 'date' || x.type === 'datetime') ? (spec.x?.timeGrain ?? 'day') : undefined;
    onSelect(selected === String(value) ? null : { columnId, value: String(value), timeGrain });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {asTable || spec.type === 'table' || !option ? (
          <TableView columns={tableColumnsFor(spec, dataset, data.rows, t)} rows={data.rows} caption={title} />
        ) : (
          <EChart option={option.option} ariaLabel={option.aria} onClick={handleClick} onReady={onInstance} />
        )}
      </div>
      {notes.length > 0 && <p className="pt-1 text-[12px] text-fg-2">{notes.join(' · ')}</p>}
    </div>
  );
}
