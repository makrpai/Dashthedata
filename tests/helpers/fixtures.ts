import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import * as XLSX from 'xlsx';
import { processDataset } from '@/lib/etl/processDataset';
import { ingestDelimitedBytes, ingestJsonText } from '@/lib/ingest';
import { readWorkbook, sheetToMatrix, type XlsxLike } from '@/lib/ingest/excel';
import { ingestMatrix } from '@/lib/ingest/matrix';
import type { Dataset, Source } from '@/types/domain';
import type { NodeRunner } from './nodeRunner';

const dir = join(__dirname, '../fixtures');
let counter = 0;

/** Loads a fixture like the browser does and runs the automatic ETL. */
export async function processFixture(
  db: NodeRunner,
  file: string,
  opts: { sheet?: string; locale?: 'fi' | 'en'; dataLocale?: 'fi' | 'en' } = {},
) {
  const id = `t${++counter}`;
  const rawTable = `raw_${id}`;
  const bytes = new Uint8Array(readFileSync(isAbsolute(file) ? file : join(dir, file)));
  const format = file.endsWith('.xlsx') ? 'xlsx' : file.endsWith('.json') ? 'json' : 'csv';
  let merged: number[] = [];
  let rowCount = 0;
  if (format === 'xlsx') {
    const wb = readWorkbook(XLSX as unknown as XlsxLike, bytes);
    const sheet = opts.sheet ?? wb.SheetNames[0];
    const m = sheetToMatrix(XLSX as unknown as XlsxLike, wb, sheet);
    merged = m.mergedColumns;
    rowCount = (await ingestMatrix(db, rawTable, m.matrix)).rowCount;
  } else if (format === 'json') {
    rowCount = (await ingestJsonText(db, { table: rawTable, text: new TextDecoder().decode(bytes) })).rowCount;
  } else {
    rowCount = (await ingestDelimitedBytes(db, { table: rawTable, bytes, format: 'csv' })).rowCount;
  }
  const sheetName = format === 'xlsx' ? (opts.sheet ?? XLSX.read(bytes, { type: 'array', bookSheets: true }).SheetNames[0]) : undefined;
  const source: Source = {
    id: `s_${id}`,
    kind: 'file',
    name: file.split('/').pop()!,
    createdAt: '2026-01-01T00:00:00Z',
    rawTable,
    rowCount,
    typedAtSource: false,
    file: { name: file.split('/').pop()!, size: bytes.length, format, sheet: sheetName },
    mergedColumns: merged,
  };
  const dataset: Dataset = {
    id: `d_${id}`,
    name: sheetName ?? file.split('/').pop()!.replace(/\.[^.]+$/, ''),
    kind: 'source',
    sourceIds: [source.id],
    inputTable: rawTable,
    pipeline: [],
    outputTable: `clean_d_${id}`,
    version: 0,
    columns: [],
    rowCount,
  };
  const result = await processDataset(db, dataset, source, {
    locale: opts.locale ?? 'fi',
    dataLocale: opts.dataLocale ?? 'fi',
    autoDetect: true,
  });
  return { ...result, source };
}

export function summary(ds: Dataset) {
  return {
    columns: ds.columns.map((c) => `${c.displayName}:${c.type}:${c.role}`),
    rowCount: ds.rowCount,
    applied: ds.pipeline.filter((s) => s.enabled && !s.suggested && !s.error).map((s) => s.kind),
    suggested: ds.pipeline.filter((s) => s.suggested).map((s) => s.kind),
    errors: ds.pipeline.filter((s) => s.error).map((s) => `${s.kind}:${s.error?.code}`),
  };
}
