'use client';

import type { EChartsOption } from 'echarts';
import type { ECharts } from 'echarts/core';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/util/cn';

let modules: Promise<typeof import('echarts/core')> | null = null;

/** Loads only the ECharts parts we use (19.1: loaded lazily inside the workspace). */
function loadEcharts() {
  if (!modules) {
    modules = Promise.all([import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers')]).then(
      ([core, charts, components, renderers]) => {
        core.use([
          charts.BarChart,
          charts.LineChart,
          charts.PieChart,
          charts.ScatterChart,
          charts.HeatmapChart,
          components.GridComponent,
          components.TooltipComponent,
          components.LegendComponent,
          components.AriaComponent,
          components.VisualMapComponent,
          components.DataZoomInsideComponent,
          renderers.CanvasRenderer,
        ]);
        return core;
      },
    );
  }
  return modules;
}

export interface EChartClick {
  name: string;
  seriesName?: string;
  dataIndex: number;
  seriesIndex?: number;
  value: unknown;
  componentType: string;
}

/** Thin React wrapper: resize observer, option updates and click events. */
export function EChart({
  option,
  ariaLabel,
  onClick,
  onReady,
  className,
}: {
  option: EChartsOption;
  ariaLabel: string;
  onClick?: (e: EChartClick) => void;
  onReady?: (chart: ECharts) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  useEffect(() => {
    clickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    void loadEcharts().then((echarts) => {
      if (disposed || !el.current) return;
      const instance = echarts.init(el.current, undefined, { renderer: 'canvas' });
      chart.current = instance;
      instance.on('click', (p) => clickRef.current?.(p as unknown as EChartClick));
      observer = new ResizeObserver(() => instance.resize());
      observer.observe(el.current);
      instance.setOption(option, true);
      onReady?.(instance);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
    // init once; option updates are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={el} role="img" aria-label={ariaLabel} className={cn('h-full w-full', className)} />;
}
