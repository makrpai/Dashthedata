'use client';

import { autoLayout, primaryDataset, suggestCharts } from '@/lib/charts/suggest';
import { useProjectStore } from '@/store';
import { useSuggestionStore } from '@/store/suggestions';
import type { ChartSpec } from '@/types/domain';
import { ensureEngine } from './engine';

const inflight = new Map<string, Promise<{ top: ChartSpec[]; more: ChartSpec[] }>>();

/** Suggestions for a dataset, cached per dataset version. */
export async function loadSuggestions(datasetId: string): Promise<{ top: ChartSpec[]; more: ChartSpec[] }> {
  const dataset = useProjectStore.getState().project?.datasets.find((d) => d.id === datasetId);
  if (!dataset || !dataset.columns.length) return { top: [], more: [] };
  const cached = useSuggestionStore.getState().byDataset[datasetId];
  if (cached && cached.version === dataset.version && !cached.loading) return cached;
  const key = `${datasetId}@${dataset.version}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  useSuggestionStore.getState().set(datasetId, { version: dataset.version, top: cached?.top ?? [], more: cached?.more ?? [], loading: true });
  const promise = (async () => {
    const runner = await ensureEngine();
    const result = await suggestCharts(runner, dataset);
    useSuggestionStore.getState().set(datasetId, { version: dataset.version, ...result, loading: false });
    return result;
  })().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * Builds a dashboard from the suggestions of the primary dataset (12.6). Replaces the first dashboard
 * when it is empty, otherwise adds a new one. Returns the dashboard id.
 */
export async function createAutoDashboard(name: string, datasetId?: string): Promise<string | null> {
  const project = useProjectStore.getState().project;
  if (!project) return null;
  const dataset = datasetId ? project.datasets.find((d) => d.id === datasetId) : primaryDataset(project.datasets);
  if (!dataset) return null;
  const { top } = await loadSuggestions(dataset.id);
  if (!top.length) return null;
  const store = useProjectStore.getState();
  for (const chart of top) store.upsertChart(chart);
  const dashboard = autoLayout(top, dataset, name);
  const empty = store.project?.dashboards.find((d) => d.tiles.length === 0);
  if (empty) {
    store.updateDashboard(empty.id, { tiles: dashboard.tiles, globalFilters: dashboard.globalFilters });
    return empty.id;
  }
  store.addDashboard(dashboard);
  return dashboard.id;
}
