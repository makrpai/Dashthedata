import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';
import { duckTypeToColumnType } from '@/lib/ingest/parquet';
import type { Locale, PipelineStep, StepEffect } from '@/types/domain';
import { stepDefinition } from './steps';
import { ROW } from './steps/helpers';
import { StepError, type ColumnRef } from './types';

export interface BaseInput {
  /** Raw table or input view. */
  table: string;
  columns: ColumnRef[];
  /** Column name in `table` for each base column (same order). */
  rawNames: string[];
}

export interface CastFailure {
  columnId: string;
  count: number;
  examples: string[];
}

export interface PipelineRunResult {
  steps: PipelineStep[];
  columns: ColumnRef[];
  /** Quoted name of the last view. */
  lastView: string;
  /** View (unquoted) holding the result after step i; for disabled steps the previous view. */
  viewByStep: string[];
  columnsByStep: ColumnRef[][];
  baseView: string;
  rowCount: number;
  castFailures: CastFailure[];
}

export interface RunOptions {
  datasetId: string;
  base: BaseInput;
  steps: PipelineStep[];
  locale: Locale;
  /** Measure row/column counts and changed cells (slower). */
  measure?: boolean;
  /** Final materialised table (clean_<id>). */
  outputTable?: string;
  /** Materialise every step as a table (large inputs). */
  materialize?: boolean;
}

export const viewName = (datasetId: string, index: number) => `${datasetId}__s${index}`;

async function dropObject(runner: QueryRunner, name: string) {
  for (const kind of ['VIEW', 'TABLE']) {
    try {
      await runner.exec(`DROP ${kind} IF EXISTS ${quoteIdent(name)}`);
    } catch {
      /* object is of the other kind */
    }
  }
}

async function createStage(runner: QueryRunner, name: string, sql: string, materialize: boolean) {
  await dropObject(runner, name);
  await runner.exec(`CREATE ${materialize ? 'TABLE' : 'VIEW'} ${quoteIdent(name)} AS ${sql}`);
}

async function countRows(runner: QueryRunner, from: string): Promise<number> {
  const [r] = await runner.query<{ n: number }>(`SELECT count(*) AS n FROM ${from}`);
  return Number(r.n);
}

function errorOf(err: unknown): PipelineStep['error'] {
  if (err instanceof StepError) return { code: err.code, params: err.params };
  const message = err instanceof Error ? err.message : String(err);
  const missing = message.match(/column "?([^"\s]+)"? not found|Referenced column "?([^"\s]+)"? not found/i);
  if (missing) return { code: 'missingColumn', params: { id: missing[1] ?? missing[2] } };
  return { code: 'sqlError', params: { message: message.split('\n')[0].slice(0, 200) } };
}

/** Columns of a view via DESCRIBE, keeping ids of columns whose SQL name is unchanged. */
async function describeColumns(runner: QueryRunner, view: string, previous: ColumnRef[]): Promise<{ columns: ColumnRef[]; hasRow: boolean }> {
  const described = await runner.query<{ column_name: string; column_type: string }>(`DESCRIBE ${quoteIdent(view)}`);
  const bySql = new Map(previous.map((c) => [c.sqlName, c]));
  const columns = described
    .filter((d) => d.column_name !== '__row')
    .map((d) => {
      const prev = bySql.get(d.column_name);
      const type = duckTypeToColumnType(d.column_type);
      return prev && (prev.type === type || (prev.type === 'varchar' && type === 'text'))
        ? prev
        : { id: prev?.id ?? `sql_${d.column_name}`, sqlName: d.column_name, displayName: prev?.displayName ?? d.column_name, type };
    });
  return { columns, hasRow: described.some((d) => d.column_name === '__row') };
}

/**
 * Runs a pipeline (9.1): one view per enabled step on top of the previous one, then materialises
 * clean_<id>. Failing steps get an error and are skipped; the pipeline continues.
 */
export async function runPipeline(runner: QueryRunner, opts: RunOptions): Promise<PipelineRunResult> {
  const materialize = opts.materialize ?? false;
  const baseView = viewName(opts.datasetId, 0);
  const baseSelect = [
    ROW,
    ...opts.base.columns.map((c, i) => `${quoteIdent(opts.base.rawNames[i])} AS ${quoteIdent(c.sqlName)}`),
  ].join(', ');
  await createStage(runner, baseView, `SELECT ${baseSelect} FROM ${quoteIdent(opts.base.table)}`, materialize);

  let current = baseView;
  let columns = opts.base.columns;
  let rows = opts.measure ? await countRows(runner, quoteIdent(baseView)) : 0;
  const viewByStep: string[] = [];
  const columnsByStep: ColumnRef[][] = [];
  const steps: PipelineStep[] = [];
  const castFailures: CastFailure[] = [];

  for (let i = 0; i < opts.steps.length; i++) {
    const step = { ...opts.steps[i], error: undefined as PipelineStep['error'] };
    const name = viewName(opts.datasetId, i + 1);
    if (!step.enabled || step.suggested) {
      step.effect = undefined;
      steps.push(step);
      viewByStep.push(current);
      columnsByStep.push(columns);
      continue;
    }
    const def = stepDefinition(step.kind);
    try {
      const parsed = def.paramsSchema.safeParse(step.params);
      if (!parsed.success) throw new StepError('invalidParams');
      let params = parsed.data as Record<string, unknown>;
      // promoteHeader re-reads the header row so refreshed data keeps working (9.3).
      if (step.kind === 'promoteHeader' && typeof params.row === 'number') {
        const header = await runner.query(
          `SELECT ${columns.map((c) => `CAST(${quoteIdent(c.sqlName)} AS VARCHAR) AS ${quoteIdent(c.id)}`).join(', ') || '1'} FROM ${quoteIdent(current)} WHERE ${ROW} = ${sqlLiteral(params.row as number)}`,
        );
        if (header[0]) params = { ...params, names: columns.map((c) => String(header[0][c.id] ?? '')) };
        step.params = params;
      }
      const out = def.toSql({ from: quoteIdent(current), columns, locale: opts.locale }, params as never);
      await createStage(runner, name, out.sql, materialize);
      let nextColumns = out.columns;
      if (step.kind === 'customSql') {
        const d = await describeColumns(runner, name, columns);
        nextColumns = d.columns;
        if (!d.hasRow) {
          await createStage(runner, name, `SELECT row_number() OVER () AS ${ROW}, * FROM (${out.sql})`, materialize);
        }
      }
      if (opts.measure) {
        const after = await countRows(runner, quoteIdent(name));
        const effect: StepEffect = { rowsBefore: rows, rowsAfter: after, colsBefore: columns.length, colsAfter: nextColumns.length };
        if (step.kind === 'castTypes') {
          const failures = await measureCastFailures(runner, current, name, columns, nextColumns);
          castFailures.push(...failures);
          effect.cellsChanged = failures.reduce((s, f) => s + f.count, 0);
        } else if (def.measuresCells) {
          effect.cellsChanged = await measureChangedCells(runner, current, name, columns, nextColumns);
        }
        step.effect = effect;
        rows = after;
      } else {
        // Force binding so broken SQL is caught even without measuring.
        await runner.query(`SELECT * FROM ${quoteIdent(name)} LIMIT 0`);
      }
      current = name;
      columns = nextColumns;
    } catch (err) {
      step.error = errorOf(err);
      step.effect = undefined;
      await dropObject(runner, name);
    }
    steps.push(step);
    viewByStep.push(current);
    columnsByStep.push(columns);
  }

  // Remove stages left over from a longer pipeline.
  const stale = await runner.query<{ name: string }>(
    `SELECT view_name AS name FROM duckdb_views() WHERE view_name LIKE ${sqlLiteral(`${opts.datasetId}__s%`)} ` +
      `UNION ALL SELECT table_name FROM duckdb_tables() WHERE table_name LIKE ${sqlLiteral(`${opts.datasetId}__s%`)}`,
  );
  for (const { name } of stale) {
    const idx = Number(name.slice(opts.datasetId.length + 3));
    if (Number.isFinite(idx) && idx > opts.steps.length) await dropObject(runner, name);
  }

  if (opts.outputTable) {
    await dropObject(runner, opts.outputTable);
    await runner.exec(`CREATE TABLE ${quoteIdent(opts.outputTable)} AS SELECT * FROM ${quoteIdent(current)} ORDER BY ${ROW}`);
    rows = await countRows(runner, quoteIdent(opts.outputTable));
  } else if (!opts.measure) {
    rows = await countRows(runner, quoteIdent(current));
  }
  return { steps, columns, lastView: quoteIdent(current), viewByStep, columnsByStep, baseView, rowCount: rows, castFailures };
}

/** Cells whose text value changed between two stages (joined on __row). */
async function measureChangedCells(
  runner: QueryRunner,
  before: string,
  after: string,
  beforeCols: ColumnRef[],
  afterCols: ColumnRef[],
): Promise<number> {
  const prev = new Map(beforeCols.map((c) => [c.id, c]));
  const pairs = afterCols.filter((c) => prev.has(c.id));
  if (!pairs.length) return 0;
  const sums = pairs.map((c) => {
    const p = prev.get(c.id)!;
    return `CASE WHEN CAST(b.${quoteIdent(p.sqlName)} AS VARCHAR) IS DISTINCT FROM CAST(a.${quoteIdent(c.sqlName)} AS VARCHAR) THEN 1 ELSE 0 END`;
  });
  const [r] = await runner.query<{ n: number | null }>(
    `SELECT sum(${sums.join(' + ')}) AS n FROM ${quoteIdent(before)} b JOIN ${quoteIdent(after)} a USING (${ROW})`,
  );
  return Number(r.n ?? 0);
}

/** Values that were present before castTypes but became NULL (parse failures, 8.1). */
async function measureCastFailures(
  runner: QueryRunner,
  before: string,
  after: string,
  beforeCols: ColumnRef[],
  afterCols: ColumnRef[],
): Promise<CastFailure[]> {
  const prev = new Map(beforeCols.map((c) => [c.id, c]));
  const changed = afterCols.filter((c) => {
    const p = prev.get(c.id);
    return p && p.type !== c.type && c.type !== 'text';
  });
  if (!changed.length) return [];
  const cond = (c: ColumnRef) => {
    const p = prev.get(c.id)!;
    return `b.${quoteIdent(p.sqlName)} IS NOT NULL AND trim(CAST(b.${quoteIdent(p.sqlName)} AS VARCHAR)) <> '' AND a.${quoteIdent(c.sqlName)} IS NULL`;
  };
  const counts = changed.map((c, i) => `count(*) FILTER (WHERE ${cond(c)}) AS "f${i}"`);
  const [r] = await runner.query(
    `SELECT ${counts.join(', ')} FROM ${quoteIdent(before)} b JOIN ${quoteIdent(after)} a USING (${ROW})`,
  );
  const result: CastFailure[] = [];
  for (let i = 0; i < changed.length; i++) {
    const count = Number(r[`f${i}`] ?? 0);
    if (!count) continue;
    const c = changed[i];
    const p = prev.get(c.id)!;
    const ex = await runner.query<{ v: string }>(
      `SELECT DISTINCT CAST(b.${quoteIdent(p.sqlName)} AS VARCHAR) AS v FROM ${quoteIdent(before)} b JOIN ${quoteIdent(after)} a USING (${ROW}) WHERE ${cond(c)} LIMIT 3`,
    );
    result.push({ columnId: c.id, count, examples: ex.map((e) => e.v) });
  }
  return result;
}
