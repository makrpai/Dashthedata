'use client';

import { create } from 'zustand';
import type { ChartSpec, Dashboard, Dataset, Project, ProjectSettings, Relationship, Source } from '@/types/domain';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

type Updater<T> = Partial<T> | ((current: T) => T);
const apply = <T,>(current: T, u: Updater<T>): T =>
  typeof u === 'function' ? (u as (c: T) => T)(current) : { ...current, ...u };

export interface ProjectState {
  project: Project | null;
  /** Aggregate state of database/API connections for the sidebar dot. */
  connectionState: 'none' | 'ok' | 'error';
  engine: EngineStatus;
  /** Dataset ids whose pipeline is running. */
  busyDatasets: string[];
  setProject: (project: Project | null) => void;
  setEngine: (status: EngineStatus) => void;
  setBusy: (datasetId: string, busy: boolean) => void;
  setConnectionState: (state: ProjectState['connectionState']) => void;
  renameProject: (name: string) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  addSource: (source: Source) => void;
  updateSource: (id: string, u: Updater<Source>) => void;
  removeSource: (id: string) => void;
  addDataset: (dataset: Dataset) => void;
  updateDataset: (id: string, u: Updater<Dataset>) => void;
  removeDataset: (id: string) => void;
  setRelationships: (u: (current: Relationship[]) => Relationship[]) => void;
  upsertChart: (chart: ChartSpec) => void;
  removeChart: (id: string) => void;
  addDashboard: (dashboard: Dashboard) => void;
  updateDashboard: (id: string, u: Updater<Dashboard>) => void;
  removeDashboard: (id: string) => void;
}

const now = () => new Date().toISOString();

/** Central project store. Every mutation bumps `updatedAt` (drives the debounced save). */
export const useProjectStore = create<ProjectState>((set) => {
  const mutate = (fn: (p: Project) => Project) =>
    set((s) => (s.project ? { project: { ...fn(s.project), updatedAt: now() } } : s));
  return {
    project: null,
    connectionState: 'none',
    engine: 'idle',
    busyDatasets: [],
    setProject: (project) => set({ project }),
    setEngine: (engine) => set({ engine }),
    setBusy: (datasetId, busy) =>
      set((s) => ({
        busyDatasets: busy
          ? [...new Set([...s.busyDatasets, datasetId])]
          : s.busyDatasets.filter((d) => d !== datasetId),
      })),
    setConnectionState: (connectionState) => set({ connectionState }),
    renameProject: (name) => mutate((p) => ({ ...p, name })),
    updateSettings: (patch) => mutate((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    addSource: (source) => mutate((p) => ({ ...p, sources: [...p.sources, source] })),
    updateSource: (id, u) =>
      mutate((p) => ({ ...p, sources: p.sources.map((s) => (s.id === id ? apply(s, u) : s)) })),
    removeSource: (id) =>
      mutate((p) => {
        const removedDatasets = new Set(p.datasets.filter((d) => d.kind === 'source' && d.sourceIds.includes(id)).map((d) => d.id));
        return {
          ...p,
          sources: p.sources.filter((s) => s.id !== id),
          datasets: p.datasets.filter((d) => !removedDatasets.has(d.id)),
          charts: p.charts.filter((c) => !removedDatasets.has(c.datasetId)),
          relationships: p.relationships.filter(
            (r) => !removedDatasets.has(r.from.datasetId) && !removedDatasets.has(r.to.datasetId),
          ),
          dashboards: p.dashboards.map((d) => ({
            ...d,
            tiles: d.tiles.filter((t) => p.charts.some((c) => c.id === t.chartId && !removedDatasets.has(c.datasetId))),
          })),
        };
      }),
    addDataset: (dataset) => mutate((p) => ({ ...p, datasets: [...p.datasets, dataset] })),
    updateDataset: (id, u) =>
      mutate((p) => ({ ...p, datasets: p.datasets.map((d) => (d.id === id ? apply(d, u) : d)) })),
    removeDataset: (id) =>
      mutate((p) => ({
        ...p,
        datasets: p.datasets.filter((d) => d.id !== id),
        charts: p.charts.filter((c) => c.datasetId !== id),
        relationships: p.relationships.filter((r) => r.from.datasetId !== id && r.to.datasetId !== id),
      })),
    setRelationships: (u) => mutate((p) => ({ ...p, relationships: u(p.relationships) })),
    upsertChart: (chart) =>
      mutate((p) => ({
        ...p,
        charts: p.charts.some((c) => c.id === chart.id)
          ? p.charts.map((c) => (c.id === chart.id ? chart : c))
          : [...p.charts, chart],
      })),
    removeChart: (id) =>
      mutate((p) => ({
        ...p,
        charts: p.charts.filter((c) => c.id !== id),
        dashboards: p.dashboards.map((d) => ({ ...d, tiles: d.tiles.filter((t) => t.chartId !== id) })),
      })),
    addDashboard: (dashboard) => mutate((p) => ({ ...p, dashboards: [...p.dashboards, dashboard] })),
    updateDashboard: (id, u) =>
      mutate((p) => ({ ...p, dashboards: p.dashboards.map((d) => (d.id === id ? apply(d, u) : d)) })),
    removeDashboard: (id) => mutate((p) => ({ ...p, dashboards: p.dashboards.filter((d) => d.id !== id) })),
  };
});

/** Non-reactive access for orchestration code. */
export const getProject = () => useProjectStore.getState().project;
