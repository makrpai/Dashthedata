'use client';

import { quoteIdent } from '@/lib/duckdb/sql';
import { getBlob } from '@/lib/persistence/idb';
import { useProjectStore } from '@/store';
import { usePipelineStore } from '@/store/pipeline';
import type { Dataset, Project, Source } from '@/types/domain';
import { ensureModelView } from '@/lib/model/apply';
import { ensureEngine, runDataset } from './engine';
import { loadRaw } from './importer';

async function tableExists(name: string): Promise<boolean> {
  const runner = await ensureEngine();
  const rows = await runner.query<{ n: number }>(
    `SELECT count(*) AS n FROM duckdb_tables() WHERE table_name = '${name.replace(/'/g, "''")}'`,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Datasets ordered so members come before the unions/joins built on them. */
export function datasetOrder(datasets: Dataset[]): Dataset[] {
  const order: Dataset[] = [];
  const seen = new Set<string>();
  const visit = (d: Dataset) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    for (const m of d.memberDatasetIds ?? []) {
      const dep = datasets.find((x) => x.id === m);
      if (dep) visit(dep);
    }
    order.push(d);
  };
  datasets.forEach(visit);
  return order;
}

/** Loads one file source from its remembered bytes (7.6). */
export async function reloadFileSource(source: Source, bytes: ArrayBuffer, file?: File): Promise<void> {
  const runner = await ensureEngine();
  if (!source.file) return;
  const r = await loadRaw(runner, { format: source.file.format, bytes, delimiter: source.file.delimiter, file }, source.rawTable, source.file.sheet);
  useProjectStore.getState().updateSource(source.id, { rowCount: r.rowCount, columnCount: r.columnCount, lastLoadedAt: new Date().toISOString() });
}

/** Recreates union/join input views (phase 7 hooks this for model datasets). */
export const viewBuilders: Array<(dataset: Dataset, project: Project) => Promise<boolean>> = [
  async (dataset, project) => ensureModelView(await ensureEngine(), dataset, project),
];

/**
 * Restores a project's data after a reload: remembered files are loaded from IndexedDB, then every
 * dataset's pipeline runs again. Database/API sources and forgotten files are reported as missing
 * ("Refresh data" / drop the file again).
 */
export async function restoreProjectData(project: Project): Promise<void> {
  const store = useProjectStore.getState();
  store.setRestoring(true);
  usePipelineStore.setState({ runs: {} });
  const missing: string[] = [];
  try {
    await ensureEngine();
    for (const source of project.sources) {
      if (await tableExists(source.rawTable)) continue;
      const blob = source.blobKey ? await getBlob(source.blobKey).catch(() => undefined) : undefined;
      if (!blob) {
        missing.push(source.id);
        continue;
      }
      try {
        await reloadFileSource(source, blob.bytes);
      } catch {
        missing.push(source.id);
      }
    }
    useProjectStore.getState().setMissingSources(missing);
    const runner = await ensureEngine();
    for (const dataset of datasetOrder(project.datasets)) {
      if (dataset.kind === 'source') {
        if (dataset.sourceIds.some((id) => missing.includes(id))) continue;
      } else {
        let ok = false;
        for (const build of viewBuilders) ok = (await build(dataset, project)) || ok;
        if (!ok) continue;
      }
      try {
        await runner.query(`SELECT 1 FROM ${quoteIdent(dataset.inputTable)} LIMIT 0`);
        await runDataset(dataset.id);
      } catch {
        /* input missing; the dataset stays unavailable until data is refreshed */
      }
    }
  } finally {
    useProjectStore.getState().setRestoring(false);
  }
}

/**
 * Reconnects dropped files to sources whose data is missing (after a reload without remembered
 * data, or an imported project file). Files are matched by name and size (13). Returns the files that
 * did not match any missing source.
 */
export async function reconnectFiles(files: File[]): Promise<File[]> {
  const store = useProjectStore.getState();
  const project = store.project;
  if (!project || !store.missingSources.length) return files;
  const rest: File[] = [];
  const fixed = new Set<string>();
  for (const file of files) {
    const targets = project.sources.filter(
      (s) => store.missingSources.includes(s.id) && s.file && s.file.name === file.name && s.file.size === file.size,
    );
    if (!targets.length) {
      rest.push(file);
      continue;
    }
    const bytes = await file.arrayBuffer();
    for (const s of targets) {
      try {
        await reloadFileSource(s, bytes, file);
        fixed.add(s.id);
      } catch {
        /* stays missing */
      }
    }
  }
  if (fixed.size) {
    const missing = useProjectStore.getState().missingSources.filter((id) => !fixed.has(id));
    useProjectStore.getState().setMissingSources(missing);
    const latest = useProjectStore.getState().project!;
    for (const dataset of datasetOrder(latest.datasets)) {
      if (dataset.kind === 'source' && !dataset.sourceIds.some((id) => fixed.has(id))) continue;
      if (dataset.kind !== 'source') {
        let ok = false;
        for (const build of viewBuilders) ok = (await build(dataset, latest)) || ok;
        if (!ok) continue;
      }
      await runDataset(dataset.id).catch(() => undefined);
    }
  }
  return rest;
}
