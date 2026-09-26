import { quoteIdent } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';
import { inferRole } from '@/lib/profile/roles';
import { computeStats } from '@/lib/profile/stats';
import type { ColumnProfile, DataWarning, Dataset, Locale, Source } from '@/types/domain';
import { autoDetect } from './detect';
import { runPipeline, type BaseInput, type PipelineRunResult } from './pipeline';
import { uniqueSqlNames } from './slugify';
import type { ColumnRef } from './types';

/** Stable ids for raw columns: col_0, col_1, … (charts reference these). */
export const rawColumnId = (i: number) => `col_${i}`;

/** Base columns of a dataset's input (raw table or union/join view). */
export async function baseInput(runner: QueryRunner, dataset: Dataset, source?: Source): Promise<BaseInput> {
  const described = (await runner.query<{ column_name: string; column_type: string }>(`DESCRIBE ${quoteIdent(dataset.inputTable)}`)).filter(
    (d) => d.column_name !== '__row',
  );
  if (dataset.kind === 'source' && source && !source.typedAtSource) {
    return {
      table: dataset.inputTable,
      rawNames: described.map((d) => d.column_name),
      columns: described.map((d, i) => ({ id: rawColumnId(i), sqlName: d.column_name, displayName: d.column_name, type: 'varchar' })),
    };
  }
  if (dataset.kind === 'source' && source?.columnNames) {
    const names = source.columnNames;
    const sqlNames = uniqueSqlNames(names);
    return {
      table: dataset.inputTable,
      rawNames: described.map((d) => d.column_name),
      columns: described.map((d, i) => ({
        id: rawColumnId(i),
        sqlName: sqlNames[i] ?? d.column_name,
        displayName: names[i] ?? d.column_name,
        type: source.columnTypes?.[i] ?? 'text',
      })),
    };
  }
  // Union and join views already carry named, typed columns; ids come from the member datasets.
  const known = new Map(dataset.columns.map((c) => [c.sqlName, c]));
  const { duckTypeToColumnType } = await import('@/lib/ingest/parquet');
  return {
    table: dataset.inputTable,
    rawNames: described.map((d) => d.column_name),
    columns: described.map((d) => {
      const k = known.get(d.column_name);
      return {
        id: k?.id ?? `in_${d.column_name}`,
        sqlName: d.column_name,
        displayName: k?.displayName ?? d.column_name,
        type: k?.type ?? duckTypeToColumnType(d.column_type),
      };
    }),
  };
}

export interface ProcessOptions {
  locale: Locale;
  dataLocale: 'fi' | 'en';
  autoDetect?: boolean;
  /** Materialise stages as tables (large inputs). */
  materialize?: boolean;
}

/** Builds ColumnProfiles (stats, roles, warnings) for the final columns (8.5, 8.6). */
export async function profileColumns(
  runner: QueryRunner,
  table: string,
  columns: ColumnRef[],
  rowCount: number,
  run: Pick<PipelineRunResult, 'castFailures' | 'steps'>,
  dataset: Pick<Dataset, 'roleOverrides'>,
): Promise<ColumnProfile[]> {
  const typed = columns.map((c) => ({ ...c, type: c.type === 'varchar' ? ('text' as const) : c.type }));
  const stats = await computeStats(
    runner,
    table,
    typed.map((c) => ({
      sqlName: c.sqlName,
      type: c.type,
      top: c.type === 'text' || c.type === 'boolean' || c.type === 'integer',
      histogram: c.type === 'integer' || c.type === 'decimal',
    })),
    rowCount,
  );
  const castWarnings = new Map<string, DataWarning[]>();
  for (const step of run.steps) {
    if (step.kind !== 'castTypes' || !step.enabled) continue;
    const w = (step.params as { warnings?: Record<string, DataWarning[]> }).warnings ?? {};
    for (const [id, list] of Object.entries(w)) castWarnings.set(id, list);
  }
  return typed.map((c, i) => {
    const s = stats[i];
    const warnings: DataWarning[] = [...(castWarnings.get(c.id) ?? [])];
    const failure = run.castFailures.find((f) => f.columnId === c.id);
    if (failure) warnings.push({ code: 'parse_failures', params: { count: failure.count, examples: failure.examples.map((e) => `"${e}"`).join(', ') } });
    if (s.count > 0 && s.nulls / s.count >= 0.5) warnings.push({ code: 'high_nulls', params: { pct: Math.round((s.nulls / s.count) * 100) } });
    const role =
      dataset.roleOverrides?.[c.id] ??
      inferRole({
        type: c.type,
        displayName: c.displayName,
        stats: s,
        rowCount,
        timeGrainHint: c.format?.timeGrainHint,
        avgLength: s.avgLength,
        lengthStddev: s.lengthStddev,
      });
    const { avgLength: _a, lengthStddev: _l, ...plain } = s;
    return {
      id: c.id,
      sqlName: c.sqlName,
      displayName: c.displayName,
      type: c.type,
      role,
      format: c.format && Object.values(c.format).some((v) => v !== undefined) ? { ...c.format } : undefined,
      stats: plain,
      warnings,
    };
  });
}

/**
 * Full processing of a dataset: auto-detection (first time), pipeline with effects, clean table and
 * column profiles. Returns the updated dataset; the caller stores it.
 */
export async function processDataset(
  runner: QueryRunner,
  dataset: Dataset,
  source: Source | undefined,
  opts: ProcessOptions,
): Promise<{ dataset: Dataset; run: PipelineRunResult }> {
  const base = await baseInput(runner, dataset, source);
  let pipeline = dataset.pipeline;
  let notes = dataset.notes;
  if (opts.autoDetect && !dataset.autoDetected) {
    const detected = await autoDetect(runner, {
      datasetId: dataset.id,
      datasetName: dataset.name,
      base,
      locale: opts.locale,
      dataLocale: opts.dataLocale,
      typedAtSource: source?.typedAtSource ?? dataset.kind !== 'source',
      mergedColumnIds: (source?.mergedColumns ?? []).map(rawColumnId),
      sheetName: source?.file?.sheet,
      canonicalNumbers: ['xlsx', 'xls', 'json'].includes(source?.file?.format ?? ''),
    });
    pipeline = [...detected.steps, ...pipeline.filter((s) => s.origin !== 'auto')];
    notes = detected.notes.length ? detected.notes : notes;
  }
  const run = await runPipeline(runner, {
    datasetId: dataset.id,
    base,
    steps: pipeline,
    locale: opts.locale,
    measure: true,
    outputTable: dataset.outputTable,
    materialize: opts.materialize,
  });
  const columns = await profileColumns(runner, dataset.outputTable, run.columns, run.rowCount, run, dataset);
  return {
    dataset: {
      ...dataset,
      pipeline: run.steps,
      notes,
      columns,
      rowCount: run.rowCount,
      version: dataset.version + 1,
      autoDetected: dataset.autoDetected || Boolean(opts.autoDetect),
    },
    run,
  };
}
