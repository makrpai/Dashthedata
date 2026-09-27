'use client';

import { useEffect } from 'react';
import { listProjects, saveProject } from '@/lib/workspace/projects';
import { useProjectStore } from '@/store';

export async function refreshProjectList() {
  const list = await listProjects().catch(() => []);
  useProjectStore.getState().setProjects(list.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt })));
}

/** Saves the project to IndexedDB 1 s after the last change (13) and keeps the project list fresh. */
export function ProjectPersistence() {
  useEffect(() => {
    void refreshProjectList();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useProjectStore.subscribe((state, prev) => {
      if (!state.project || state.project === prev.project || state.restoring) return;
      if (timer) clearTimeout(timer);
      const project = state.project;
      timer = setTimeout(() => {
        void saveProject(project).then(refreshProjectList);
      }, 1000);
    });
    const flush = () => {
      const p = useProjectStore.getState().project;
      if (timer && p) void saveProject(p);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}
