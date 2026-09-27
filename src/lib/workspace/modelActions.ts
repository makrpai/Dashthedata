'use client';

import { ensureModelView, joinDataset, unionDataset } from '@/lib/model/apply';
import { detectRelationships } from '@/lib/model/relationships';
import { useProjectStore } from '@/store';
import { ensureEngine, runDataset } from './engine';

export async function refreshRelationships(): Promise<number> {
  const project = useProjectStore.getState().project;
  if (!project) return 0;
  const runner = await ensureEngine();
  const detected = await detectRelationships(runner, project.datasets.filter((d) => d.kind === 'source'));
  const kept = project.relationships.filter((r) => r.status !== 'suggested');
  const fresh = detected.filter(
    (rel) =>
      !kept.some(
        (k) =>
          k.from.datasetId === rel.from.datasetId &&
          k.from.columnId === rel.from.columnId &&
          k.to.datasetId === rel.to.datasetId &&
          k.to.columnId === rel.to.columnId,
      ),
  );
  useProjectStore.getState().setRelationships(() => [...kept, ...fresh]);
  return fresh.length;
}

export async function createUnionDataset(datasetIds: string[], name: string): Promise<string | null> {
  const project = useProjectStore.getState().project;
  if (!project) return null;
  const members = datasetIds.map((id) => project.datasets.find((d) => d.id === id)).filter((d) => Boolean(d));
  if (members.length < 2) return null;
  const dataset = unionDataset(members as NonNullable<(typeof members)[number]>[], name);
  const runner = await ensureEngine();
  const ok = await ensureModelView(runner, dataset, project);
  if (!ok) return null;
  useProjectStore.getState().addDataset(dataset);
  await runDataset(dataset.id);
  return dataset.id;
}

export async function createJoinDataset(factId: string, name: string): Promise<string | null> {
  const project = useProjectStore.getState().project;
  const fact = project?.datasets.find((d) => d.id === factId);
  if (!project || !fact) return null;
  const dataset = joinDataset(fact, name, project);
  if (!dataset) return null;
  const runner = await ensureEngine();
  const ok = await ensureModelView(runner, dataset, { ...project, datasets: [...project.datasets, dataset] });
  if (!ok) return null;
  useProjectStore.getState().addDataset(dataset);
  await runDataset(dataset.id);
  return dataset.id;
}

export function setRelationshipStatus(id: string, status: 'accepted' | 'rejected' | 'suggested'): void {
  useProjectStore.getState().setRelationships((rels) => rels.map((r) => (r.id === id ? { ...r, status } : r)));
}
