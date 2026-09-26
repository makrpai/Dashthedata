'use client';

import { getRunner, type BrowserRunner } from '@/lib/duckdb/client';
import { quoteIdent } from '@/lib/duckdb/sql';
import { useProjectStore } from '@/store';
import type { ColumnProfile, Dataset } from '@/types/domain';

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

/**
 * Materialises a dataset. Phase 1: copies the raw table into clean_<id> and exposes the raw
 * columns. Replaced by the ETL pipeline runner in phase 3.
 */
export async function runDataset(datasetId: string, _opts: { autoDetect?: boolean } = {}): Promise<void> {
  const store = useProjectStore.getState();
  const dataset = store.project?.datasets.find((d) => d.id === datasetId);
  if (!dataset) return;
  store.setBusy(datasetId, true);
  try {
    const runner = await ensureEngine();
    await runner.exec(
      `CREATE OR REPLACE TABLE ${quoteIdent(dataset.outputTable)} AS SELECT * FROM ${quoteIdent(dataset.inputTable)} ORDER BY "__row"`,
    );
    const described = await runner.query<{ column_name: string }>(`DESCRIBE ${quoteIdent(dataset.outputTable)}`);
    const [{ n }] = await runner.query<{ n: number }>(`SELECT count(*) AS n FROM ${quoteIdent(dataset.outputTable)}`);
    const columns: ColumnProfile[] = described
      .filter((c) => c.column_name !== '__row')
      .map((c, i) => ({
        id: `col_${c.column_name}`,
        sqlName: c.column_name,
        displayName: `${i + 1}`,
        type: 'text',
        role: 'text',
        stats: { count: Number(n), nulls: 0, distinct: 0 },
        warnings: [],
      }));
    useProjectStore.getState().updateDataset(datasetId, (d: Dataset) => ({
      ...d,
      columns,
      rowCount: Number(n),
      version: d.version + 1,
    }));
  } finally {
    useProjectStore.getState().setBusy(datasetId, false);
  }
}
