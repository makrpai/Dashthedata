import type { Dataset, FilterClause } from '@/types/domain';

export type ScopedClause = FilterClause & { datasetId: string };

/**
 * Maps dashboard filters onto one dataset (11.2): a clause applies when its column belongs to the
 * dataset, or (join datasets) when the dataset carries that column from a joined dimension.
 */
export function filtersForDataset(dataset: Pick<Dataset, 'id' | 'columns'>, clauses: ScopedClause[]): FilterClause[] {
  const out: FilterClause[] = [];
  for (const { datasetId, ...clause } of clauses) {
    if (datasetId === dataset.id) {
      if (dataset.columns.some((c) => c.id === clause.columnId)) out.push(clause);
      continue;
    }
    const mapped = dataset.columns.find((c) => c.originDatasetId === datasetId && c.originColumnId === clause.columnId);
    if (mapped) out.push({ ...clause, columnId: mapped.id });
  }
  return out;
}
