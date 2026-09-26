'use client';

import { closeWorkbook, openWorkbook, readSheet } from '@/lib/ingest/excelClient';
import { ExcelError, type SheetInfo } from '@/lib/ingest/excel';
import {
  IngestError,
  LIMITS,
  baseName,
  detectFormat,
  ingestDelimitedBytes,
  ingestJsonText,
  ingestParquetBytes,
  type RawIngestResult,
} from '@/lib/ingest';
import { decodeText, isUtf8 } from '@/lib/ingest/encoding';
import { ingestCsvFile } from '@/lib/ingest/csv';
import { ingestMatrix } from '@/lib/ingest/matrix';
import { putBlob } from '@/lib/persistence/idb';
import { createEmptyProject } from '@/lib/project';
import { newId } from '@/lib/util/id';
import { useProjectStore } from '@/store';
import type { Dataset, FileFormat, Source } from '@/types/domain';
import { ensureEngine, runDataset } from './engine';

export interface PreparedFile {
  key: string;
  file: File;
  format: FileFormat;
  bytes: ArrayBuffer;
  /** Large UTF-8 CSV: `bytes` holds only a sample and DuckDB reads the File handle directly. */
  streamed?: boolean;
  /** Excel only. */
  workbookId?: number;
  sheets?: SheetInfo[];
}

export interface ImportIssue {
  fileName: string;
  key: string;
  params?: Record<string, string | number>;
}

/** Reads, size-checks and (for Excel) parses the workbook structure of dropped files. */
export async function prepareFiles(files: File[]): Promise<{ prepared: PreparedFile[]; issues: ImportIssue[] }> {
  const prepared: PreparedFile[] = [];
  const issues: ImportIssue[] = [];
  for (const file of files) {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const format = detectFormat(file.name, head);
    if (!format) {
      issues.push({ fileName: file.name, key: 'ingest.error.unsupported' });
      continue;
    }
    const limit = format === 'xlsx' || format === 'xls' ? LIMITS.excel : format === 'parquet' ? LIMITS.parquet : LIMITS.text;
    if (file.size > limit) {
      issues.push({ fileName: file.name, key: 'errors.fileTooLarge', params: { size: file.size, max: limit } });
      continue;
    }
    let item: PreparedFile;
    if ((format === 'csv' || format === 'tsv') && file.size > LIMITS.largeText) {
      const sample = await file.slice(0, 1024 * 1024).arrayBuffer();
      const utf8 = isUtf8(new Uint8Array(sample));
      item = { key: newId('f'), file, format, bytes: utf8 ? sample : await file.arrayBuffer(), streamed: utf8 };
    } else {
      item = { key: newId('f'), file, format, bytes: await file.arrayBuffer() };
    }
    if (format === 'xlsx' || format === 'xls') {
      try {
        const wb = await openWorkbook(item.bytes);
        item.workbookId = wb.workbookId;
        item.sheets = wb.sheets;
      } catch (err) {
        issues.push({
          fileName: file.name,
          key: err instanceof ExcelError && err.code === 'passwordProtected' ? 'ingest.error.passwordProtected' : 'ingest.error.unreadable',
        });
        continue;
      }
    }
    prepared.push(item);
  }
  return { prepared, issues };
}

/** Default sheet choice: all visible, non-empty sheets (7.2). */
export function defaultSheets(sheets: SheetInfo[]): string[] {
  return sheets.filter((s) => !s.hidden && !s.empty).map((s) => s.name);
}

function ensureProject(name: string) {
  const store = useProjectStore.getState();
  if (!store.project) store.setProject(createEmptyProject(name));
}

/**
 * Creates sources, raw tables and datasets for prepared files and runs their pipelines.
 * Returns the ids of the new datasets.
 */
export async function importPrepared(
  prepared: PreparedFile[],
  sheetChoice: Record<string, string[]>,
  projectName: string,
): Promise<{ datasetIds: string[]; issues: ImportIssue[]; cleaned: number }> {
  const runner = await ensureEngine();
  ensureProject(projectName);
  const datasetIds: string[] = [];
  const issues: ImportIssue[] = [];
  let cleaned = 0;
  for (const item of prepared) {
    const units: Array<{ sheet?: string }> =
      item.sheets !== undefined ? (sheetChoice[item.key] ?? defaultSheets(item.sheets)).map((sheet) => ({ sheet })) : [{}];
    const blobKey = item.key;
    // Streamed files are too large to copy into IndexedDB; they must be dropped again after reload.
    const remember = (useProjectStore.getState().project?.settings.rememberData ?? true) && !item.streamed;
    if (remember) {
      await putBlob(blobKey, {
        name: item.file.name,
        type: item.file.type,
        lastModified: item.file.lastModified,
        bytes: item.bytes,
      }).catch(() => undefined);
    }
    for (const unit of units) {
      try {
        const sourceId = newId('s');
        const rawTable = `raw_${sourceId}`;
        const result = await loadRaw(runner, item, rawTable, unit.sheet);
        const source: Source = {
          id: sourceId,
          kind: 'file',
          name: unit.sheet ? `${item.file.name} / ${unit.sheet}` : item.file.name,
          createdAt: new Date().toISOString(),
          lastLoadedAt: new Date().toISOString(),
          rawTable,
          rowCount: result.rowCount,
          columnCount: result.columnCount,
          typedAtSource: Boolean(result.typed),
          file: {
            name: item.file.name,
            size: item.file.size,
            format: item.format,
            sheet: unit.sheet,
            encoding: result.encoding,
            delimiter: result.delimiter,
            lastModified: item.file.lastModified,
          },
          columnNames: result.typed?.columnNames,
          columnTypes: result.typed?.columnTypes,
          blobKey: remember ? blobKey : undefined,
          mergedColumns: result.mergedColumns,
          warnings: result.warnings.length ? result.warnings : undefined,
        };
        const datasetId = newId('d');
        const dataset: Dataset = {
          id: datasetId,
          name: unit.sheet ?? baseName(item.file.name),
          kind: 'source',
          sourceIds: [sourceId],
          inputTable: rawTable,
          pipeline: [],
          outputTable: `clean_${datasetId}`,
          version: 0,
          columns: [],
          rowCount: result.rowCount,
        };
        const store = useProjectStore.getState();
        store.addSource(source);
        store.addDataset(dataset);
        cleaned += await runDataset(datasetId, { autoDetect: true });
        datasetIds.push(datasetId);
      } catch (err) {
        console.warn('[import] failed', err instanceof Error ? err.message : err);
        issues.push({
          fileName: unit.sheet ? `${item.file.name} / ${unit.sheet}` : item.file.name,
          key: err instanceof IngestError ? err.key : 'ingest.error.unreadable',
          params: err instanceof IngestError ? err.params : undefined,
        });
      }
    }
    if (item.workbookId !== undefined) await closeWorkbook(item.workbookId).catch(() => undefined);
  }
  return { datasetIds, issues, cleaned };
}

type LoadResult = RawIngestResult & { mergedColumns?: number[] };

/** Loads one file (or one Excel sheet) into a raw table. Shared with project reload. */
export async function loadRaw(
  runner: Awaited<ReturnType<typeof ensureEngine>>,
  item: { format: FileFormat; bytes: ArrayBuffer; workbookId?: number; delimiter?: string; streamed?: boolean; file?: File },
  rawTable: string,
  sheet?: string,
): Promise<LoadResult> {
  const bytes = new Uint8Array(item.bytes);
  if (item.streamed && item.file && (item.format === 'csv' || item.format === 'tsv')) {
    const virtualName = `${rawTable}.csv`;
    await runner.registerFile(virtualName, item.file);
    try {
      const r = await ingestCsvFile(runner, {
        virtualName,
        table: rawTable,
        sample: decodeText(bytes).text,
        delimiter: item.delimiter ?? (item.format === 'tsv' ? '\t' : undefined),
      });
      return { rowCount: r.rowCount, columnCount: r.columnCount, encoding: 'utf-8', delimiter: r.delimiter, warnings: [] };
    } finally {
      await runner.dropFile(virtualName);
    }
  }
  switch (item.format) {
    case 'csv':
    case 'tsv':
      return ingestDelimitedBytes(runner, { table: rawTable, bytes, format: item.format, delimiter: item.delimiter });
    case 'json':
      return ingestJsonText(runner, { table: rawTable, text: decodeText(bytes).text });
    case 'parquet':
      return ingestParquetBytes(runner, { table: rawTable, bytes });
    case 'xlsx':
    case 'xls': {
      let workbookId = item.workbookId;
      let opened = false;
      if (workbookId === undefined) {
        workbookId = (await openWorkbook(item.bytes)).workbookId;
        opened = true;
      }
      try {
        const sheetData = await readSheet(workbookId, sheet ?? '');
        if (sheetData.matrix.length === 0) throw new IngestError('ingest.error.empty');
        const r = await ingestMatrix(runner, rawTable, sheetData.matrix);
        return {
          ...r,
          mergedColumns: sheetData.mergedColumns,
          warnings: sheetData.errorCells ? [{ key: 'ingest.warning.errorCells', params: { count: sheetData.errorCells } }] : [],
        };
      } finally {
        if (opened) await closeWorkbook(workbookId).catch(() => undefined);
      }
    }
  }
}

/** Fetches a bundled sample from /samples as a File. */
export async function fetchSample(fileName: string): Promise<File> {
  const res = await fetch(`/samples/${encodeURIComponent(fileName)}`);
  if (!res.ok) throw new IngestError('ingest.error.unreadable');
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type, lastModified: Date.UTC(2026, 0, 3) });
}
