import type { QueryRunner } from '@/lib/duckdb/types';
import type { FileFormat } from '@/types/domain';
import { ingestCsvFile } from './csv';
import { decodeText } from './encoding';
import { jsonToMatrix } from './json';
import { ingestMatrix } from './matrix';
import { ingestParquetFile, type TypedIngestResult } from './parquet';

export { detectFormat, baseName } from './detect';
export { LIMITS, formatBytes } from './limits';

export interface RawIngestResult {
  rowCount: number;
  columnCount: number;
  encoding?: string;
  delimiter?: string;
  recordsPath?: string | null;
  typed?: TypedIngestResult;
  warnings: Array<{ key: string; params?: Record<string, string | number> }>;
}

export class IngestError extends Error {
  constructor(
    readonly key: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(key);
  }
}

/** CSV/TSV from bytes: decode (BOM, UTF-8 → windows-1252), register, load (7.3). */
export async function ingestDelimitedBytes(
  runner: QueryRunner,
  opts: { table: string; bytes: Uint8Array; format: 'csv' | 'tsv'; delimiter?: string },
): Promise<RawIngestResult> {
  const { text, encoding } = decodeText(opts.bytes);
  if (!text.trim()) throw new IngestError('ingest.error.empty');
  const virtualName = `${opts.table}.csv`;
  await runner.registerText(virtualName, text);
  try {
    const r = await ingestCsvFile(runner, {
      virtualName,
      table: opts.table,
      sample: text.slice(0, 65536),
      delimiter: opts.delimiter ?? (opts.format === 'tsv' ? '\t' : undefined),
    });
    return { rowCount: r.rowCount, columnCount: r.columnCount, encoding, delimiter: r.delimiter, warnings: [] };
  } finally {
    await runner.dropFile(virtualName);
  }
}

/** JSON text → flattened matrix → raw table (7.4). */
export async function ingestJsonText(
  runner: QueryRunner,
  opts: { table: string; text: string; recordsPath?: string },
): Promise<RawIngestResult> {
  let data: unknown;
  try {
    data = JSON.parse(opts.text);
  } catch {
    // JSON Lines fallback
    const lines = opts.text.split(/\r?\n/).filter((l) => l.trim());
    try {
      data = lines.map((l) => JSON.parse(l) as unknown);
    } catch {
      throw new IngestError('ingest.error.invalidJson');
    }
  }
  const { matrix, recordsPath, warnings } = jsonToMatrix(data, opts.recordsPath);
  if (matrix.length <= 1) throw new IngestError('ingest.error.noRecords');
  const r = await ingestMatrix(runner, opts.table, matrix);
  return { ...r, recordsPath, warnings };
}

export async function ingestParquetBytes(
  runner: QueryRunner,
  opts: { table: string; bytes: Uint8Array },
): Promise<RawIngestResult> {
  const virtualName = `${opts.table}.parquet`;
  await runner.registerBuffer(virtualName, opts.bytes);
  try {
    const typed = await ingestParquetFile(runner, { virtualName, table: opts.table });
    return { rowCount: typed.rowCount, columnCount: typed.columnNames.length, typed, warnings: [] };
  } catch (err) {
    if (err instanceof IngestError) throw err;
    throw new IngestError('ingest.error.unreadable');
  }
}

export function isTextFormat(format: FileFormat): format is 'csv' | 'tsv' | 'json' {
  return format === 'csv' || format === 'tsv' || format === 'json';
}
