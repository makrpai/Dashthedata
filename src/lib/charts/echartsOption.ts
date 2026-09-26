import type { EChartsOption, SeriesOption } from 'echarts';
import type { TDynamic } from '@/lib/i18n';
import type { Row } from '@/lib/duckdb/types';
import type { ChartSpec, ColumnProfile, Dataset, Locale } from '@/types/domain';
import { escapeHtml, formatDate, formatNumber, formatPercent } from './format';
import { categoryLabel, entityColorIndex, measureLabel } from './labels';
import { OTHER } from './queryBuilder';
import { columnOf, isTime } from './spec';

export interface ChartTheme {
  palette: string[];
  /** Neutral colour for "Other". */
  other: string;
  text: string;
  text2: string;
  line: string;
  surface: string;
  accent: string;
  /** Sequential ramp endpoints (light → dark) for heatmaps. */
  sequential: [string, string];
  fontFamily: string;
}

export interface OptionContext {
  locale: Locale;
  theme: ChartTheme;
  dataset: Pick<Dataset, 'columns' | 'name'>;
  t: TDynamic;
  /** Cross-filter selection on this chart: highlight it and dim the rest. */
  selected?: string | null;
  reducedMotion?: boolean;
  /** Accessible summary (computed by chartSummary). */
  ariaLabel?: string;
}

const DIM = 0.3;

function xLabel(value: unknown, x: ColumnProfile | undefined, spec: ChartSpec, ctx: OptionContext): string {
  if (x && (x.type === 'date' || x.type === 'datetime')) {
    return formatDate(String(value), ctx.locale, spec.x?.timeGrain ?? x.format?.timeGrainHint);
  }
  return categoryLabel(value, ctx.t);
}

function tooltipBase(theme: ChartTheme) {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: theme.text, fontFamily: theme.fontFamily, fontSize: 13 },
    extraCssText: 'border-radius:10px;box-shadow:none;',
    confine: true,
  };
}

function axisCommon(theme: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: theme.line } },
    axisTick: { show: false },
    axisLabel: { color: theme.text2, fontFamily: theme.fontFamily, fontSize: 12, hideOverlap: true },
    splitLine: { lineStyle: { color: theme.line, type: 'dashed' as const } },
  };
}

const swatch = (color: string) =>
  `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${color}"></span>`;

/** Converts a spec + query rows into an ECharts option (11.3). Pure: no DOM access. */
export function toEChartsOption(spec: ChartSpec, rows: Row[], ctx: OptionContext): EChartsOption {
  const { theme, locale, t, dataset } = ctx;
  const x = columnOf(dataset, spec.x?.columnId);
  const seriesCol = columnOf(dataset, spec.series?.columnId);
  const yCols = spec.y.map((y) => (y.columnId === '*' ? undefined : columnOf(dataset, y.columnId)));
  const fmt = (v: unknown, i = 0, compact = false) =>
    typeof v === 'number' ? formatNumber(v, locale, { format: yCols[i]?.format, compact }) : '';
  const common: EChartsOption = {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: theme.fontFamily, color: theme.text },
    aria: { enabled: true, label: { enabled: true, description: ctx.ariaLabel ?? '' } },
    animation: !ctx.reducedMotion,
    animationDuration: 300,
    tooltip: tooltipBase(theme),
  };
  const big = rows.length > 2000;

  if (spec.type === 'donut') {
    const data = rows
      .filter((r) => typeof r.y0 === 'number' && (r.y0 as number) > 0)
      .map((r) => {
        const key = String(r.x);
        const color = key === OTHER ? theme.other : theme.palette[entityColorIndex(key, x, theme.palette.length)];
        const dim = ctx.selected != null && ctx.selected !== key;
        return { name: categoryLabel(r.x, t), value: r.y0 as number, raw: key, itemStyle: { color, opacity: dim ? DIM : 1 } };
      });
    const total = data.reduce((s, d) => s + d.value, 0);
    return {
      ...common,
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'item',
        formatter: (p) => {
          const item = p as unknown as { name: string; value: number; color: string };
          return `${swatch(item.color)}${escapeHtml(item.name)}<br/><b>${escapeHtml(fmt(item.value))}</b> · ${escapeHtml(formatPercent(total ? item.value / total : 0, locale))}`;
        },
      },
      legend: { bottom: 0, type: 'scroll', textStyle: { color: theme.text2 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
      series: [
        {
          type: 'pie',
          radius: ['52%', '76%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 4 },
          label: { show: data.length <= 6, color: theme.text2, formatter: (p) => `${(p as { percent: number }).percent.toFixed(0)} %` },
          data,
        },
      ],
    };
  }

  if (spec.type === 'scatter') {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = seriesCol ? String(r.s) : '';
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const series: SeriesOption[] = [...groups.entries()].map(([key, rs]) => ({
      type: 'scatter',
      name: key ? categoryLabel(key, t) : measureLabel(spec.y[0], dataset, t),
      symbolSize: 8,
      large: big,
      itemStyle: {
        color: key === OTHER ? theme.other : theme.palette[key ? entityColorIndex(key, seriesCol, theme.palette.length) : 0],
        borderColor: theme.surface,
        borderWidth: 1,
        opacity: 0.85,
      },
      data: rs.map((r) => [r.x as number, r.y0 as number]),
    }));
    return {
      ...common,
      grid: { left: 8, right: 16, top: groups.size > 1 ? 36 : 16, bottom: 8, containLabel: true },
      legend: groups.size > 1 ? { top: 0, type: 'scroll', textStyle: { color: theme.text2 } } : undefined,
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'item',
        formatter: (p) => {
          const item = p as unknown as { value: [number, number]; seriesName: string; color: string };
          return `${swatch(item.color)}${escapeHtml(item.seriesName)}<br/>${escapeHtml(x?.displayName ?? '')}: <b>${escapeHtml(formatNumber(item.value[0], locale, { format: x?.format }))}</b><br/>${escapeHtml(measureLabel(spec.y[0], dataset, t))}: <b>${escapeHtml(fmt(item.value[1]))}</b>`;
        },
      },
      xAxis: { type: 'value', scale: true, name: x?.displayName, nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: theme.text2 }, ...axisCommon(theme), axisLabel: { ...axisCommon(theme).axisLabel, formatter: (v: number) => formatNumber(v, locale, { format: x?.format, compact: true }) } },
      yAxis: { type: 'value', scale: true, ...axisCommon(theme), axisLabel: { ...axisCommon(theme).axisLabel, formatter: (v: number) => fmt(v, 0, true) } },
      series,
    };
  }

  if (spec.type === 'histogram') {
    const labels = rows.map((r) => `${formatNumber(r.from as number, locale, { format: x?.format, compact: true })}–${formatNumber(r.to as number, locale, { format: x?.format, compact: true })}`);
    return {
      ...common,
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (ps) => {
          const p = (ps as unknown as Array<{ dataIndex: number; value: number }>)[0];
          return `${escapeHtml(labels[p.dataIndex])}<br/><b>${escapeHtml(formatNumber(p.value, locale))}</b>`;
        },
      },
      xAxis: { type: 'category', data: labels, ...axisCommon(theme) },
      yAxis: { type: 'value', ...axisCommon(theme) },
      series: [{ type: 'bar', barCategoryGap: '6%', itemStyle: { color: theme.palette[0], borderRadius: [4, 4, 0, 0] }, data: rows.map((r) => r.y0 as number) }],
    };
  }

  if (spec.type === 'heatmap') {
    const xs = [...new Set(rows.map((r) => String(r.x)))];
    const ss = [...new Set(rows.map((r) => String(r.s)))];
    const values = rows.map((r) => r.y0 as number).filter((v) => typeof v === 'number');
    return {
      ...common,
      grid: { left: 8, right: 16, top: 16, bottom: 48, containLabel: true },
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'item',
        formatter: (p) => {
          const v = (p as unknown as { value: [number, number, number] }).value;
          return `${escapeHtml(xLabel(xs[v[0]], x, spec, ctx))} · ${escapeHtml(categoryLabel(ss[v[1]], t))}<br/><b>${escapeHtml(fmt(v[2]))}</b>`;
        },
      },
      xAxis: { type: 'category', data: xs.map((v) => xLabel(v, x, spec, ctx)), ...axisCommon(theme), splitArea: { show: false } },
      yAxis: { type: 'category', data: ss.map((v) => categoryLabel(v, t)), ...axisCommon(theme) },
      visualMap: {
        min: Math.min(...values, 0),
        max: Math.max(...values, 1),
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 120,
        itemWidth: 10,
        calculable: false,
        inRange: { color: theme.sequential },
        textStyle: { color: theme.text2 },
        formatter: (v) => fmt(Number(v), 0, true),
      },
      series: [
        {
          type: 'heatmap',
          itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 4 },
          data: rows.map((r) => [xs.indexOf(String(r.x)), ss.indexOf(String(r.s)), r.y0 as number]),
        },
      ],
    };
  }

  // ---------- line / area / bar / hbar / stackedBar ----------
  const horizontal = spec.type === 'hbar';
  const line = spec.type === 'line' || spec.type === 'area';
  const stacked = spec.type === 'stackedBar' || Boolean(spec.options?.stacked);
  const xValues = [...new Set(rows.map((r) => String(r.x)))];
  const time = isTime(x) && x?.type !== 'text';
  const categories = xValues.map((v) => xLabel(v, x, spec, ctx));
  let series: SeriesOption[];

  if (seriesCol) {
    const keys = [...new Set(rows.map((r) => String(r.s)))].sort((a, b) => (a === OTHER ? 1 : b === OTHER ? -1 : 0));
    const lookup = new Map(rows.map((r) => [`${r.x}|${r.s}`, r.y0 as number]));
    // Topmost stacked segment per category gets the rounded data-end.
    const topKey = new Map<string, string>();
    if (stacked) for (const xv of xValues) for (const k of keys) if (lookup.get(`${xv}|${k}`) != null) topKey.set(xv, k);
    series = keys.map((k) => {
      const color = k === OTHER ? theme.other : theme.palette[entityColorIndex(k, seriesCol, theme.palette.length)];
      const dim = ctx.selected != null && ctx.selected !== k;
      return {
        type: line ? 'line' : 'bar',
        name: categoryLabel(k, t),
        stack: stacked && !line ? 'total' : undefined,
        itemStyle: { color, opacity: dim ? DIM : 1, borderColor: stacked ? theme.surface : undefined, borderWidth: stacked ? 1 : 0 },
        lineStyle: line ? { width: 2, opacity: dim ? DIM : 1 } : undefined,
        areaStyle: spec.type === 'area' ? { opacity: 0.12 } : undefined,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: xValues.length <= 24,
        emphasis: { focus: 'series' },
        large: big,
        data: xValues.map((xv) => {
          const v = lookup.get(`${xv}|${k}`) ?? null;
          const radius = stacked ? (topKey.get(xv) === k ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
          return line ? v : { value: v, itemStyle: { borderRadius: radius } };
        }),
      } as SeriesOption;
    });
  } else {
    series = spec.y.map((_, i) => {
      const color = theme.palette[i];
      return {
        type: line ? 'line' : 'bar',
        name: measureLabel(spec.y[i], dataset, t),
        itemStyle: { color, borderRadius: line ? undefined : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
        lineStyle: line ? { width: 2 } : undefined,
        areaStyle: spec.type === 'area' ? { opacity: 0.12 } : undefined,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: xValues.length <= 24,
        barMaxWidth: 48,
        large: big,
        progressive: big ? 2000 : undefined,
        label: spec.options?.showLabels
          ? { show: true, position: horizontal ? 'right' : 'top', color: theme.text2, formatter: (p: { value: number }) => fmt(p.value, i, true) }
          : undefined,
        data: rows.map((r) => {
          const dim = ctx.selected != null && ctx.selected !== String(r.x);
          return line ? (r[`y${i}`] as number) : { value: r[`y${i}`] as number, itemStyle: { opacity: dim ? DIM : 1 } };
        }),
      } as SeriesOption;
    });
  }

  const legend = series.length > 1 ? { top: 0, type: 'scroll' as const, textStyle: { color: theme.text2 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10 } : undefined;
  const categoryAxis = {
    type: 'category' as const,
    data: categories,
    boundaryGap: !line,
    inverse: horizontal,
    ...axisCommon(theme),
    splitLine: { show: false },
    axisLabel: { ...axisCommon(theme).axisLabel, width: horizontal ? 120 : undefined, overflow: 'truncate' as const },
  };
  const valueAxis = {
    type: 'value' as const,
    ...axisCommon(theme),
    axisLabel: { ...axisCommon(theme).axisLabel, formatter: (v: number) => fmt(v, 0, true) },
  };
  return {
    ...common,
    legend,
    grid: { left: 8, right: 16, top: legend ? 36 : 16, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'axis',
      axisPointer: { type: line ? 'line' : 'shadow', lineStyle: { color: theme.text2, width: 1 } },
      formatter: (ps) => {
        const list = ps as unknown as Array<{ axisValueLabel: string; seriesName: string; value: number | { value: number } | null; color: string; seriesIndex: number }>;
        if (!list.length) return '';
        const val = (v: (typeof list)[number]['value']) => (v && typeof v === 'object' ? v.value : v);
        const total = stacked ? list.reduce((s, p) => s + (Number(val(p.value)) || 0), 0) : 0;
        const lines = list
          .filter((p) => val(p.value) != null)
          .map((p) => {
            const v = Number(val(p.value));
            const share = stacked && total ? ` · ${formatPercent(v / total, locale)}` : '';
            return `${swatch(p.color)}${escapeHtml(p.seriesName)}: <b>${escapeHtml(fmt(v, seriesCol ? 0 : p.seriesIndex))}</b>${escapeHtml(share)}`;
          });
        return `${escapeHtml(list[0].axisValueLabel)}<br/>${lines.join('<br/>')}`;
      },
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series,
    ...(time && line ? { dataZoom: xValues.length > 60 ? [{ type: 'inside' }] : undefined } : {}),
  };
}

/** Accessible one-sentence summary (19.3): "Bar chart: Sales / Region. Largest Helsinki 4.2M, smallest Oulu 0.8M." */
export function chartSummary(spec: ChartSpec, rows: Row[], title: string, ctx: Pick<OptionContext, 't' | 'locale' | 'dataset'>): string {
  const { t, locale, dataset } = ctx;
  const head = t('chart.aria.summary', { type: t(`chart.typeNames.${spec.type}`), title });
  const x = columnOf(dataset, spec.x?.columnId);
  const yCol = spec.y[0] && spec.y[0].columnId !== '*' ? columnOf(dataset, spec.y[0].columnId) : undefined;
  const fmtV = (v: number) => formatNumber(v, locale, { format: yCol?.format, compact: true });
  const pts = rows.filter((r) => typeof r.y0 === 'number' && r.x !== undefined && !('s' in r));
  if (!pts.length || spec.type === 'scatter' || spec.type === 'histogram') return head;
  const label = (v: unknown) =>
    x && (x.type === 'date' || x.type === 'datetime') ? formatDate(String(v), locale, spec.x?.timeGrain) : categoryLabel(v, t);
  if (isTime(x) && x?.type !== 'text') {
    return `${head} ${t('chart.aria.trend', { first: `${label(pts[0].x)} ${fmtV(pts[0].y0 as number)}`, last: `${label(pts.at(-1)!.x)} ${fmtV(pts.at(-1)!.y0 as number)}` })}`;
  }
  const sorted = [...pts].sort((a, b) => (b.y0 as number) - (a.y0 as number));
  return `${head} ${t('chart.aria.extremes', { maxLabel: label(sorted[0].x), max: fmtV(sorted[0].y0 as number), minLabel: label(sorted.at(-1)!.x), min: fmtV(sorted.at(-1)!.y0 as number) })}`;
}
