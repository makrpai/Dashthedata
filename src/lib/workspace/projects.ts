'use client';

import { clearAll, deleteBlob, deleteProject, getMeta, getProjectById, listProjects, putProject, setMeta } from '@/lib/persistence/idb';
import { createEmptyProject } from '@/lib/project';
import { newId } from '@/lib/util/id';
import { useProjectStore } from '@/store';
import type { Project } from '@/types/domain';
import { restoreProjectData } from './restore';

export const LAST_PROJECT = 'lastProject';

/** Saves immediately (the store subscription debounces normal edits). */
export async function saveProject(project: Project): Promise<void> {
  await putProject(project);
  await setMeta(LAST_PROJECT, project.id);
}

export async function openProject(id: string): Promise<boolean> {
  const current = useProjectStore.getState().project;
  if (current) await saveProject(current);
  const project = await getProjectById(id);
  if (!project) return false;
  useProjectStore.getState().setProject(project);
  await setMeta(LAST_PROJECT, id);
  await restoreProjectData(project);
  return true;
}

/** Opens the last project on startup (if any). */
export async function openLastProject(): Promise<void> {
  if (useProjectStore.getState().project) return;
  const id = await getMeta<string>(LAST_PROJECT).catch(() => undefined);
  if (id) await openProject(id);
}

export async function newProject(name: string): Promise<Project> {
  const current = useProjectStore.getState().project;
  if (current) await saveProject(current);
  const project = createEmptyProject(name);
  useProjectStore.getState().setProject(project);
  useProjectStore.getState().setMissingSources([]);
  await saveProject(project);
  return project;
}

export async function removeProject(id: string): Promise<void> {
  const project = await getProjectById(id);
  for (const s of project?.sources ?? []) if (s.blobKey) await deleteBlob(s.blobKey).catch(() => undefined);
  await deleteProject(id);
  if (useProjectStore.getState().project?.id === id) useProjectStore.getState().setProject(null);
}

export async function duplicateProject(id: string, suffix: string): Promise<Project | null> {
  const project = await getProjectById(id);
  if (!project) return null;
  const now = new Date().toISOString();
  const copy: Project = { ...project, id: newId('p'), name: `${project.name} ${suffix}`, createdAt: now, updatedAt: now };
  await putProject(copy);
  return copy;
}

export async function importProjectObject(project: Project): Promise<void> {
  const current = useProjectStore.getState().project;
  if (current) await saveProject(current);
  const existing = await getProjectById(project.id);
  const imported = existing ? { ...project, id: newId('p') } : project;
  useProjectStore.getState().setProject(imported);
  await saveProject(imported);
  await restoreProjectData(imported);
}

export async function clearEverything(): Promise<void> {
  await clearAll();
  useProjectStore.getState().setProject(null);
}

export { listProjects };
