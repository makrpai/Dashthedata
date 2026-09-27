import { newId } from '@/lib/util/id';
import type { ScopedClause } from '@/lib/charts/filters';
import { useProjectStore } from '@/store';
import type { CrossFilter, Dashboard, FilterClause, GlobalFilter } from '@/types/domain';

/** Turns one global filter's stored value into a filter clause, or null when it has no value ("all"). */
export function globalFilterClause(gf: GlobalFilter): ScopedClause | null {
  if (gf.value === undefined || gf.value === null) return null;
  if (gf.kind === 'dateRange') {
    const range = gf.value as [string, string];
    if (!range[0] && !range[1]) return null;
    return { datasetId: gf.columnRef.datasetId, columnId: gf.columnRef.columnId, op: 'between', value: range };
  }
  if (gf.kind === 'multiSelect') {
    const values = gf.value as string[];
    if (!values.length) return null;
    return { datasetId: gf.columnRef.datasetId, columnId: gf.columnRef.columnId, op: 'in', value: values };
  }
  const range = gf.value as [number | undefined, number | undefined];
  if (range[0] === undefined && range[1] === undefined) return null;
  return {
    datasetId: gf.columnRef.datasetId,
    columnId: gf.columnRef.columnId,
    op: 'between',
    value: [range[0] ?? '', range[1] ?? ''],
  };
}

/**
 * All active filters for a dashboard (13): global filters plus the cross-filter, unless
 * `excludeTileId` is the tile that produced the cross-filter (the source tile is never filtered by
 * its own selection, though it is still highlighted).
 */
export function effectiveFilters(dashboard: Dashboard, excludeTileId?: string): ScopedClause[] {
  const clauses = dashboard.globalFilters.map(globalFilterClause).filter((c): c is ScopedClause => c !== null);
  if (dashboard.crossFilter && dashboard.crossFilter.sourceTileId !== excludeTileId) {
    clauses.push(dashboard.crossFilter.clause);
  }
  return clauses;
}

export function setGlobalFilterValue(dashboardId: string, filterId: string, value: FilterClause['value'] | undefined): void {
  useProjectStore.getState().updateDashboard(dashboardId, (d) => ({
    ...d,
    globalFilters: d.globalFilters.map((f) => (f.id === filterId ? { ...f, value } : f)),
  }));
}

export function clearAllFilters(dashboardId: string): void {
  useProjectStore.getState().updateDashboard(dashboardId, (d) => ({
    ...d,
    globalFilters: d.globalFilters.map((f) => ({ ...f, value: undefined })),
    crossFilter: undefined,
  }));
}

export function setCrossFilter(dashboardId: string, cross: CrossFilter | undefined): void {
  useProjectStore.getState().updateDashboard(dashboardId, (d) => ({ ...d, crossFilter: cross }));
}

/** Adds a global filter for a column that does not have one yet. */
export function addGlobalFilter(dashboardId: string, gf: Omit<GlobalFilter, 'id'>): void {
  useProjectStore.getState().updateDashboard(dashboardId, (d) => ({
    ...d,
    globalFilters: [...d.globalFilters, { id: newId('gf'), ...gf }],
  }));
}

export function removeGlobalFilter(dashboardId: string, filterId: string): void {
  useProjectStore.getState().updateDashboard(dashboardId, (d) => ({
    ...d,
    globalFilters: d.globalFilters.filter((f) => f.id !== filterId),
  }));
}
