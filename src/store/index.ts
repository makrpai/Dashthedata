'use client';

import { create } from 'zustand';
import type { Project, ProjectSettings } from '@/types/domain';

export interface ProjectState {
  project: Project | null;
  /** Aggregate state of database/API connections for the sidebar dot. */
  connectionState: 'none' | 'ok' | 'error';
  setProject: (project: Project | null) => void;
  renameProject: (name: string) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
}

/** Central project store. Actions for sources, datasets, charts and dashboards live in slices. */
export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  connectionState: 'none',
  setProject: (project) => set({ project }),
  renameProject: (name) =>
    set((s) => (s.project ? { project: { ...s.project, name, updatedAt: new Date().toISOString() } } : s)),
  updateSettings: (patch) =>
    set((s) =>
      s.project
        ? {
            project: {
              ...s.project,
              settings: { ...s.project.settings, ...patch },
              updatedAt: new Date().toISOString(),
            },
          }
        : s,
    ),
}));
