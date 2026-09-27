'use client';

import { rowsFromJson } from '@/lib/connectors/http';
import { quoteIdent } from '@/lib/duckdb/sql';
import { ingestDelimitedBytes } from '@/lib/ingest';
import { createEmptyProject } from '@/lib/project';
import { newId } from '@/lib/util/id';
import { useProjectStore } from '@/store';
import type { Dataset, Source, SourceKind } from '@/types/domain';
import { ensureEngine, runDataset } from './engine';

export async function importRemoteTable(opts: {
  name: string;
  kind: Extract<SourceKind, 'http' | 'postgres' | 'mysql' | 'demo-db'>;
  headers: string[];
  rows: string[][];
  http?: Source['http'];
  db?: Source['db'];
}): Promise<string> {
  if (!useProjectStore.getState().project) useProjectStore.getState().setProject(createEmptyProject(opts.name));
  const runner = await ensureEngine();
  const sourceId = newId('s');
  const datasetId = newId('d');
  const rawTable = `raw_${sourceId}`;
  const width = opts.headers.length;
  const matrix = [opts.headers, ...opts.rows].map((row) => Array.from({ length: width }, (_, i) => (row[i] ? row[i] : null)));
  await runner.createStringTable(rawTable, Array.from({ length: width }, (_, i) => `c${i}`), matrix);
  const source: Source = {
    id: sourceId,
    kind: opts.kind,
    name: opts.name,
    createdAt: new Date().toISOString(),
    lastLoadedAt: new Date().toISOString(),
    rawTable,
    rowCount: opts.rows.length,
    columnCount: width,
    typedAtSource: false,
    http: opts.http,
    db: opts.db,
  };
  const dataset: Dataset = {
    id: datasetId,
    name: opts.name,
    kind: 'source',
    sourceIds: [sourceId],
    inputTable: rawTable,
    pipeline: [],
    outputTable: `clean_${datasetId}`,
    version: 0,
    columns: [],
    rowCount: opts.rows.length,
  };
  useProjectStore.getState().addSource(source);
  useProjectStore.getState().addDataset(dataset);
  await runDataset(datasetId, { autoDetect: true });
  return datasetId;
}

export async function importRemoteCsv(opts: { name: string; text: string; http?: Source['http'] }): Promise<string> {
  if (!useProjectStore.getState().project) useProjectStore.getState().setProject(createEmptyProject(opts.name));
  const runner = await ensureEngine();
  const sourceId = newId('s');
  const datasetId = newId('d');
  const rawTable = `raw_${sourceId}`;
  const loaded = await ingestDelimitedBytes(runner, { table: rawTable, bytes: new TextEncoder().encode(opts.text), format: 'csv' });
  const source: Source = {
    id: sourceId,
    kind: 'http',
    name: opts.name,
    createdAt: new Date().toISOString(),
    lastLoadedAt: new Date().toISOString(),
    rawTable,
    rowCount: loaded.rowCount,
    columnCount: loaded.columnCount,
    typedAtSource: false,
    http: opts.http,
  };
  const dataset: Dataset = {
    id: datasetId,
    name: opts.name,
    kind: 'source',
    sourceIds: [sourceId],
    inputTable: rawTable,
    pipeline: [],
    outputTable: `clean_${datasetId}`,
    version: 0,
    columns: [],
    rowCount: loaded.rowCount,
  };
  useProjectStore.getState().addSource(source);
  useProjectStore.getState().addDataset(dataset);
  await runDataset(datasetId, { autoDetect: true });
  return datasetId;
}

function sqlForSource(source: Source): string {
  const query = source.db?.query;
  if (!query) return 'SELECT 1';
  if (query.mode === 'sql') return query.sql;
  const table = query.schema ? `${quoteIdent(query.schema)}.${quoteIdent(query.table)}` : quoteIdent(query.table);
  const columns = query.columns?.length ? query.columns.map(quoteIdent).join(', ') : '*';
  return `SELECT ${columns} FROM ${table}`;
}

async function loadRemote(source: Source, password?: string): Promise<{ headers: string[]; rows: string[][]; csv?: string }> {
  if (source.http) {
    if (source.http.url.startsWith('/')) {
      const res = await fetch(source.http.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (source.http.format === 'csv') return { headers: [], rows: [], csv: await res.text() };
      return rowsFromJson(await res.json());
    }
    const res = await fetch('/api/connectors/http', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: source.http.url }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    const body = (await res.json()) as { format: 'csv'; text: string } | { format: 'json'; headers: string[]; rows: string[][] };
    if (body.format === 'csv') return { headers: [], rows: [], csv: body.text };
    return { headers: body.headers, rows: body.rows };
  }
  if (!source.db || (source.kind !== 'postgres' && source.kind !== 'mysql')) throw new Error('This source cannot be refreshed');
  if (!password) throw new Error('password');
  const res = await fetch(`/api/connectors/${source.kind}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      host: source.db.host,
      port: source.db.port,
      database: source.db.database,
      user: source.db.user,
      password,
      ssl: source.db.ssl === 'require',
      sql: sqlForSource(source),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { headers: string[]; rows: string[][] };
}

/** Re-reads a database or HTTP source into its existing table and reruns the dataset. */
export async function refreshSource(sourceId: string, password?: string): Promise<void> {
  const source = useProjectStore.getState().project?.sources.find((s) => s.id === sourceId);
  const dataset = useProjectStore.getState().project?.datasets.find((d) => d.kind === 'source' && d.sourceIds.includes(sourceId));
  if (!source || !dataset) return;
  const loaded = await loadRemote(source, password);
  const runner = await ensureEngine();
  if (loaded.csv !== undefined) {
    const table = await ingestDelimitedBytes(runner, { table: source.rawTable, bytes: new TextEncoder().encode(loaded.csv), format: 'csv' });
    useProjectStore.getState().updateSource(sourceId, {
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      lastLoadedAt: new Date().toISOString(),
    });
  } else {
    const width = loaded.headers.length;
    const matrix = [loaded.headers, ...loaded.rows].map((row) => Array.from({ length: width }, (_, i) => (row[i] ? row[i] : null)));
    await runner.createStringTable(source.rawTable, Array.from({ length: width }, (_, i) => `c${i}`), matrix);
    useProjectStore.getState().updateSource(sourceId, {
      rowCount: loaded.rows.length,
      columnCount: width,
      columnNames: loaded.headers,
      lastLoadedAt: new Date().toISOString(),
    });
  }
  await runDataset(dataset.id, { autoDetect: false });
}
