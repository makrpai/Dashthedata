'use client';

import { create } from 'zustand';
import type { ColumnRef } from '@/lib/etl/types';
import type { PipelineStep } from '@/types/domain';

export interface RunInfo {
  viewByStep: string[];
  columnsByStep: ColumnRef[][];
  sqlByStep: Array<string | null>;
  baseView: string;
  baseColumns: ColumnRef[];
  /** Increments per run; previews use it as a cache key. */
  runId: number;
  /** True right after the automatic clean-up; drives the log animation once. */
  justDetected: boolean;
}

interface History {
  past: PipelineStep[][];
  future: PipelineStep[][];
}

interface PipelineUiState {
  runs: Record<string, RunInfo>;
  history: Record<string, History>;
  setRun: (datasetId: string, run: Omit<RunInfo, 'runId'>) => void;
  clearJustDetected: (datasetId: string) => void;
  record: (datasetId: string, previous: PipelineStep[]) => void;
  undo: (datasetId: string, current: PipelineStep[]) => PipelineStep[] | null;
  redo: (datasetId: string, current: PipelineStep[]) => PipelineStep[] | null;
}

const MAX_HISTORY = 50;
let runCounter = 0;

/** Non-persisted pipeline UI state: last run views and the undo/redo stacks (9.1). */
export const usePipelineStore = create<PipelineUiState>((set, get) => ({
  runs: {},
  history: {},
  setRun: (datasetId, run) => set((s) => ({ runs: { ...s.runs, [datasetId]: { ...run, runId: ++runCounter } } })),
  clearJustDetected: (datasetId) =>
    set((s) => (s.runs[datasetId] ? { runs: { ...s.runs, [datasetId]: { ...s.runs[datasetId], justDetected: false } } } : s)),
  record: (datasetId, previous) =>
    set((s) => {
      const h = s.history[datasetId] ?? { past: [], future: [] };
      return { history: { ...s.history, [datasetId]: { past: [...h.past, previous].slice(-MAX_HISTORY), future: [] } } };
    }),
  undo: (datasetId, current) => {
    const h = get().history[datasetId];
    if (!h?.past.length) return null;
    const prev = h.past[h.past.length - 1];
    set((s) => ({ history: { ...s.history, [datasetId]: { past: h.past.slice(0, -1), future: [current, ...h.future] } } }));
    return prev;
  },
  redo: (datasetId, current) => {
    const h = get().history[datasetId];
    if (!h?.future.length) return null;
    const next = h.future[0];
    set((s) => ({ history: { ...s.history, [datasetId]: { past: [...h.past, current], future: h.future.slice(1) } } }));
    return next;
  },
}));
