'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { refreshProjectList } from '@/components/providers/ProjectPersistence';
import { parseProjectFile, PROJECT_FILE_EXT } from '@/lib/persistence/projectFile';
import { useT } from '@/lib/i18n/useT';
import {
  duplicateProject as duplicateStoredProject,
  importProjectObject,
  listProjects,
  newProject as createProject,
  openProject as open,
  removeProject,
  saveProject,
} from '@/lib/workspace/projects';
import { useProjectStore } from '@/store';

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
}

/** Project list and lifecycle actions for the switcher (17.1) and landing page. */
export function useProjectActions() {
  const t = useT();
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const project = useProjectStore((s) => s.project);
  const newProject = useCallback(async () => {
    await createProject(t('project.untitled'));
    await refreshProjectList();
    router.push('/workspace/data');
  }, [router, t]);
  const openProject = useCallback(
    async (id: string) => {
      await open(id);
      await refreshProjectList();
      router.push('/workspace/dashboards');
    },
    [router],
  );
  const importProject = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${PROJECT_FILE_EXT},.json,application/json`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const project = parseProjectFile(await file.text());
        await importProjectObject(project);
        await refreshProjectList();
        toast.success(t('project.imported'));
        router.push('/workspace/data');
      } catch {
        toast.error(t('project.importFailed'));
      }
    };
    input.click();
  }, [router, t]);
  const renameProject = useCallback(async () => {
    if (!project) return;
    const next = window.prompt(t('project.renamePrompt'), project.name)?.trim();
    if (!next || next === project.name) return;
    useProjectStore.getState().renameProject(next);
    const updated = useProjectStore.getState().project;
    if (updated) await saveProject(updated);
    await refreshProjectList();
    toast.success(t('project.renamed'));
  }, [project, t]);
  const duplicateProject = useCallback(
    async (id: string) => {
      const copy = await duplicateStoredProject(id, t('project.copySuffix'));
      if (!copy) return;
      await refreshProjectList();
      await openProject(copy.id);
    },
    [openProject, t],
  );
  const deleteProject = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(t('project.deleteConfirm', { name }))) return;
      const deletingActive = useProjectStore.getState().project?.id === id;
      await removeProject(id);
      await refreshProjectList();
      if (deletingActive) {
        const remaining = await listProjects();
        if (remaining[0]) {
          await openProject(remaining[0].id);
        } else {
          await newProject();
        }
      }
      toast.success(t('project.deleted'));
    },
    [newProject, openProject, t],
  );
  return { projects, project, newProject, openProject, importProject, renameProject, duplicateProject, deleteProject };
}
