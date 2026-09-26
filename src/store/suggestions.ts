'use client';

import { create } from 'zustand';
import type { ChartSpec } from '@/types/domain';

interface Entry {
  version: number;
  top: ChartSpec[];
  more: ChartSpec[];
  loading: boolean;
}

interface SuggestionState {
  byDataset: Record<string, Entry>;
  set: (datasetId: string, entry: Entry) => void;
}

/** Computed suggestions per dataset version (not persisted; cheap to recompute). */
export const useSuggestionStore = create<SuggestionState>((set) => ({
  byDataset: {},
  set: (datasetId, entry) => set((s) => ({ byDataset: { ...s.byDataset, [datasetId]: entry } })),
}));
