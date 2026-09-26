'use client';

import { useCallback } from 'react';
import { createEmptyProject } from '@/lib/project';
import { useT } from '@/lib/i18n/useT';
import { useProjectStore } from '@/store';

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
}

/** Project list and lifecycle actions. Persistence is wired in phase 6. */
export function useProjectActions() {
  const t = useT();
  const setProject = useProjectStore((s) => s.setProject);
  const projects: ProjectMeta[] = [];
  const newProject = useCallback(
    () => setProject(createEmptyProject(t('project.untitled'))),
    [setProject, t],
  );
  const openProject = useCallback((id: string) => void id, []);
  const importProject = useCallback(() => undefined, []);
  return { projects, newProject, openProject, importProject };
}
