'use client';

import { create } from 'zustand';
import type { PreparedFile } from '@/lib/workspace/importer';

interface ImportState {
  /** Files handed over from another page (e.g. the landing drop zone). */
  queued: File[];
  /** Excel files waiting for the sheet picker. */
  picking: PreparedFile[] | null;
  /** Non-Excel files prepared in the same drop, imported together with the picked sheets. */
  others: PreparedFile[];
  busy: boolean;
  progress: string | null;
  lastImported: string[];
  queue: (files: File[]) => void;
  takeQueued: () => File[];
  set: (patch: Partial<Omit<ImportState, 'queue' | 'takeQueued' | 'set'>>) => void;
}

export const useImportStore = create<ImportState>((set, get) => ({
  queued: [],
  picking: null,
  others: [],
  busy: false,
  progress: null,
  lastImported: [],
  queue: (files) => set({ queued: [...get().queued, ...files] }),
  takeQueued: () => {
    const files = get().queued;
    set({ queued: [] });
    return files;
  },
  set: (patch) => set(patch),
}));
