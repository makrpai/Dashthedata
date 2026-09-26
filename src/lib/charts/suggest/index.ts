import type { QueryRunner } from '@/lib/duckdb/types';
import type { ChartSpec, Dataset } from '@/types/domain';
import { buildCandidates } from './candidates';
import { diversify } from './diversity';

export { autoLayout } from './autoLayout';

/** Rule-based suggestions (12): 8 best diverse charts plus KPIs, and the rest as "more". */
export async function suggestCharts(runner: QueryRunner, dataset: Dataset): Promise<{ top: ChartSpec[]; more: ChartSpec[] }> {
  const candidates = await buildCandidates(runner, dataset);
  return diversify(candidates, 8);
}

/** The dataset suggestions and the auto dashboard are built for: joins first, then the biggest visible one. */
export function primaryDataset(datasets: Dataset[]): Dataset | undefined {
  const visible = datasets.filter((d) => !d.hidden && d.columns.length > 0);
  return visible.find((d) => d.kind === 'join') ?? visible.find((d) => d.kind === 'union') ?? visible[0];
}
