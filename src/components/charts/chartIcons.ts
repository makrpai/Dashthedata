import {
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartColumnStacked,
  ChartLine,
  ChartNoAxesColumn,
  ChartPie,
  ChartScatter,
  Gauge,
  Grid3x3,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import type { ChartType } from '@/types/domain';

export const CHART_ICONS: Record<ChartType, LucideIcon> = {
  kpi: Gauge,
  line: ChartLine,
  area: ChartArea,
  bar: ChartColumn,
  hbar: ChartBar,
  stackedBar: ChartColumnStacked,
  scatter: ChartScatter,
  histogram: ChartNoAxesColumn,
  donut: ChartPie,
  heatmap: Grid3x3,
  table: Table2,
};
