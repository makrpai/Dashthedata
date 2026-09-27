'use client';

import { getRunner, type BrowserRunner } from '@/lib/duckdb/client';
import { processDataset } from '@/lib/etl/processDataset';
import { ensureModelView } from '@/lib/model/apply';
import { detectLocale, isLocale, type Locale } from '@/lib/i18n';
import { useProjectStore } from '@/store';
import { usePipelineStore } from '@/store/pipeline';
import type { PipelineStep } from '@/types/domain';

/** Starts DuckDB-WASM (once) and reflects its state in the store. */
export async function ensureEngine(): Promise<BrowserRunner> {
  const { engine, setEngine } = useProjectStore.getState();
  if (engine !== 'ready') setEngine('loading');
  try {
    const runner = await getRunner();
    useProjectStore.getState().setEngine('ready');
    return runner;
  } catch (err) {
    useProjectStore.getState().setEngine('error');
    throw err;
  }
}

export function uiLocale(): Locale {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'en';
  return isLocale(lang) ? lang : 'en';
}

/** Data interpretation locale (16): project setting, 'auto' → browser language. */
export function dataLocale(): 'fi' | 'en' {
  const setting = useProjectStore.getState().project?.settings.dataLocale ?? 'auto';
  if (setting !== 'auto') return setting;
  return detectLocale(typeof navigator !== 'undefined' ? navigator.language : uiLocale());
}

/** Datasets that must be re-run when this one changes (unions/joins built on it). */
function dependents(datasetId: string): string[] {
  const project = useProjectStore.getState().project;
  if (!project) return [];
  return project.datasets.filter((d) => d.memberDatasetIds?.includes(datasetId)).map((d) => d.id);
}

/**
 * Runs a dataset's pipeline (with auto-detection the first time), profiles the result and stores it.
 * Returns the number of automatic steps applied (for the summary toast).
 */
export async function runDataset(datasetId: string, opts: { autoDetect?: boolean } = {}): Promise<number> {
  const store = useProjectStore.getState();
  const dataset = store.project?.datasets.find((d) => d.id === datasetId);
  if (!dataset) return 0;
  const source = store.project?.sources.find((s) => s.id === dataset.sourceIds[0]);
  store.setBusy(datasetId, true);
  try {
    const runner = await ensureEngine();
    if (dataset.kind !== 'source') {
      const project = useProjectStore.getState().project;
      if (!project || !(await ensureModelView(runner, dataset, project))) return 0;
    }
    const autoDetect = Boolean(opts.autoDetect && dataset.kind === 'source');
    const firstTime = Boolean(autoDetect && !dataset.autoDetected);
    const { dataset: updated, run } = await processDataset(runner, dataset, dataset.kind === 'source' ? source : undefined, {
      locale: uiLocale(),
      dataLocale: dataLocale(),
      autoDetect,
      materialize: (source?.rowCount ?? dataset.rowCount) > 200_000,
    });
    const previous = new Map(dataset.columns.map((c) => [c.sqlName, c]));
    updated.columns = updated.columns.map((c) => {
      const prev = previous.get(c.sqlName);
      return prev ? { ...c, originDatasetId: prev.originDatasetId, originColumnId: prev.originColumnId } : c;
    });
    // The user may have edited the pipeline meanwhile; keep the latest params but take effects/errors.
    useProjectStore.getState().updateDataset(datasetId, () => updated);
    usePipelineStore.getState().setRun(datasetId, {
      viewByStep: run.viewByStep,
      columnsByStep: run.columnsByStep,
      sqlByStep: run.sqlByStep,
      baseView: run.baseView,
      baseColumns: run.baseColumns,
      justDetected: firstTime,
    });
    for (const dep of dependents(datasetId)) await runDataset(dep);
    return firstTime ? updated.pipeline.filter((s) => s.origin === 'auto' && s.enabled && !s.error).length : 0;
  } finally {
    useProjectStore.getState().setBusy(datasetId, false);
  }
}

/** Replaces a pipeline (recording history) and re-runs the dataset. */
export async function setPipeline(datasetId: string, steps: PipelineStep[], opts: { record?: boolean } = {}): Promise<void> {
  const dataset = useProjectStore.getState().project?.datasets.find((d) => d.id === datasetId);
  if (!dataset) return;
  if (opts.record !== false) usePipelineStore.getState().record(datasetId, dataset.pipeline);
  useProjectStore.getState().updateDataset(datasetId, { pipeline: steps });
  await runDataset(datasetId);
}

export async function undoPipeline(datasetId: string): Promise<boolean> {
  const dataset = useProjectStore.getState().project?.datasets.find((d) => d.id === datasetId);
  if (!dataset) return false;
  const prev = usePipelineStore.getState().undo(datasetId, dataset.pipeline);
  if (!prev) return false;
  await setPipeline(datasetId, prev, { record: false });
  return true;
}

export async function redoPipeline(datasetId: string): Promise<boolean> {
  const dataset = useProjectStore.getState().project?.datasets.find((d) => d.id === datasetId);
  if (!dataset) return false;
  const next = usePipelineStore.getState().redo(datasetId, dataset.pipeline);
  if (!next) return false;
  await setPipeline(datasetId, next, { record: false });
  return true;
}
