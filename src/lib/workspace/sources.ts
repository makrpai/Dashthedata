'use client';

import { quoteIdent } from '@/lib/duckdb/sql';
import { deleteBlob } from '@/lib/persistence/idb';
import { useProjectStore } from '@/store';
import { ensureEngine } from './engine';

/** Removes a source, its datasets, charts and DuckDB tables/views. */
export async function removeSourceAndTables(sourceId: string): Promise<void> {
  const project = useProjectStore.getState().project;
  const source = project?.sources.find((s) => s.id === sourceId);
  if (!project || !source) return;
  const datasets = project.datasets.filter((d) => d.kind === 'source' && d.sourceIds.includes(sourceId));
  useProjectStore.getState().removeSource(sourceId);
  const stillUsed = project.sources.some((s) => s.id !== sourceId && s.blobKey && s.blobKey === source.blobKey);
  if (source.blobKey && !stillUsed) await deleteBlob(source.blobKey).catch(() => undefined);
  try {
    const runner = await ensureEngine();
    for (const d of datasets) {
      await runner.exec(`DROP TABLE IF EXISTS ${quoteIdent(d.outputTable)}`);
      for (let i = 0; i < d.pipeline.length + 1; i++) await runner.exec(`DROP VIEW IF EXISTS ${quoteIdent(`${d.id}__s${i}`)}`);
    }
    await runner.exec(`DROP TABLE IF EXISTS ${quoteIdent(source.rawTable)}`);
  } catch {
    /* engine not available: tables disappear with the page anyway */
  }
}
