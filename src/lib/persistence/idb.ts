'use client';

import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';
import type { Project } from '@/types/domain';

let store: UseStore | null = null;
function db(): UseStore {
  if (!store) store = createStore('dashthedata', 'kv');
  return store;
}

export interface StoredBlob {
  name: string;
  type: string;
  lastModified: number;
  bytes: ArrayBuffer;
}

/** File bytes are stored under `blob:<key>` (7.6). */
export async function putBlob(key: string, file: StoredBlob): Promise<void> {
  await set(`blob:${key}`, file, db());
}
export async function getBlob(key: string): Promise<StoredBlob | undefined> {
  return get<StoredBlob>(`blob:${key}`, db());
}
export async function deleteBlob(key: string): Promise<void> {
  await del(`blob:${key}`, db());
}

/** Projects are stored under `project:<id>` (13). */
export async function putProject(project: Project): Promise<void> {
  await set(`project:${project.id}`, project, db());
}
export async function getProjectById(id: string): Promise<Project | undefined> {
  return get<Project>(`project:${id}`, db());
}
export async function deleteProject(id: string): Promise<void> {
  await del(`project:${id}`, db());
}
export async function listProjects(): Promise<Project[]> {
  const all = (await keys(db())).filter((k): k is string => typeof k === 'string' && k.startsWith('project:'));
  const projects = await Promise.all(all.map((k) => get<Project>(k, db())));
  return projects
    .filter((p): p is Project => Boolean(p))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function clearAll(): Promise<void> {
  const all = await keys(db());
  await Promise.all(all.map((k) => del(k, db())));
}

/** Small key/value for app state such as the last opened project id. */
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return get<T>(`meta:${key}`, db());
}
export async function setMeta<T>(key: string, value: T): Promise<void> {
  await set(`meta:${key}`, value, db());
}
