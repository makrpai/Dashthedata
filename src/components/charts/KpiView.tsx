'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { formatNumber, formatPercent } from '@/lib/charts/format';
import type { Row } from '@/lib/duckdb/types';
import { useT } from '@/lib/i18n/useT';
import type { ColumnFormat } from '@/types/domain';
import { EChart } from './EChart';
import { useChartTheme } from './useChartTheme';

/** Key figure (17.5 "numbers first"): 27 px value, label below, change with an arrow, sparkline. */
export function KpiView({ row, spark, label, format }: { row?: Row; spark?: Row[]; label: string; format?: ColumnFormat }) {
  const t = useT();
  const theme = useChartTheme();
  const value = typeof row?.value === 'number' ? row.value : null;
  const current = row?.mode === 'range' ? value : typeof row?.current === 'number' ? row.current : null;
  const previous = typeof row?.previous === 'number' ? row.previous : null;
  const change = current !== null && previous ? (current - previous) / Math.abs(previous) : null;
  const sparkOption = useMemo<EChartsOption | null>(
    () =>
      spark && spark.length > 1
        ? {
            animation: false,
            grid: { left: 0, right: 0, top: 4, bottom: 0 },
            xAxis: { type: 'category', show: false, data: spark.map((r) => String(r.x)) },
            yAxis: { type: 'value', show: false, scale: true },
            tooltip: { show: false },
            series: [{ type: 'line', data: spark.map((r) => r.y0 as number), showSymbol: false, lineStyle: { width: 2, color: theme.palette[0] }, areaStyle: { color: theme.palette[0], opacity: 0.1 } }],
          }
        : null,
    [spark, theme],
  );
  const Arrow = change === null ? Minus : change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <div className="flex h-full flex-col justify-between gap-1">
      <div>
        <p className="tabular text-[27px] leading-tight font-bold" data-numeric>
          {value === null ? '–' : formatNumber(value, t.locale, { format, compact: Math.abs(value) >= 100000 })}
        </p>
        <p className="text-[13px] text-fg-2">{label}</p>
        {change !== null ? (
          <p className={`mt-1 flex items-center gap-1 text-[13px] font-semibold ${change > 0 ? 'text-success' : 'text-fg-2'}`}>
            <Arrow className="size-4" aria-hidden />
            <span className="tabular">
              {change > 0 ? '+' : ''}
              {formatPercent(change, t.locale)}
            </span>
            <span className="font-normal text-fg-2">{row?.mode === 'range' ? t('chart.compareRange') : t('chart.comparePrevious')}</span>
          </p>
        ) : null}
      </div>
      {sparkOption && (
        <div className="h-10 min-h-10" aria-hidden>
          <EChart option={sparkOption} ariaLabel="" />
        </div>
      )}
    </div>
  );
}
