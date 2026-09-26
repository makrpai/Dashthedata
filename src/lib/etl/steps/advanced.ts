import { z } from 'zod';
import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import { filterClauseSql } from '@/lib/charts/filterSql';
import { dateCastSql, type DateFormatId } from '@/lib/profile/dateFormat';
import { numberCastSql } from '@/lib/profile/numberFormat';
import type { CastColumn } from '@/lib/profile/inferType';
import { filterClauseSchema, localizedSchema } from '@/types/schemas';
import type { ColumnType, FilterClause, Localized } from '@/types/domain';
import { compileExpression, resultColumnType } from '../expression';
import { freshSqlName, uniqueSqlNames } from '../slugify';
import { StepError, type ColumnRef, type StepDefinition } from '../types';
import { ROW, col, isTextual, q, selectList } from './helpers';

// ---------- unpivot ----------
export interface UnpivotParams {
  idColumnIds: string[];
  valueColumnIds: string[];
  periodName: Localized;
  valueName: Localized;
  periodParse: 'month' | 'quarter' | 'year' | 'date';
  year?: number;
  /** Period value per value column: ISO date, or a number (month 1–12 without a year, or year). */
  periods: Array<string | number>;
  periodColumnId: string;
  valueColumnId: string;
}

export const unpivot: StepDefinition<UnpivotParams> = {
  kind: 'unpivot',
  paramsSchema: z.object({
    idColumnIds: z.array(z.string()),
    valueColumnIds: z.array(z.string()).min(1),
    periodName: localizedSchema,
    valueName: localizedSchema,
    periodParse: z.enum(['month', 'quarter', 'year', 'date']),
    year: z.number().int().optional(),
    periods: z.array(z.union([z.string(), z.number()])),
    periodColumnId: z.string(),
    valueColumnId: z.string(),
  }),
  toSql: ({ from, columns, locale }, p) => {
    const ids = p.idColumnIds.map((id) => col(columns, id));
    const values = p.valueColumnIds.map((id) => col(columns, id));
    if (p.periods.length !== values.length) throw new StepError('invalidParams');
    const isDate = typeof p.periods[0] === 'string';
    const periodType: ColumnType = isDate ? 'date' : 'integer';
    const periodList = p.periods.map((v) => (typeof v === 'string' ? `DATE ${sqlLiteral(v)}` : sqlLiteral(v))).join(', ');
    // Values may already be typed; unify as VARCHAR unless they all share a numeric type.
    const allNumeric = values.every((v) => v.type === 'integer' || v.type === 'decimal');
    const valueList = values.map((v) => (allNumeric ? `CAST(${q(v)} AS DOUBLE)` : `CAST(${q(v)} AS VARCHAR)`)).join(', ');
    const ord = values.map((_, i) => i).join(', ');
    const periodDisplay = p.periodName[locale];
    const valueDisplay = p.valueName[locale];
    const [periodSql, valueSql] = uniqueSqlNames([periodDisplay, valueDisplay], ids.map((c) => c.sqlName));
    const idSelect = ids.map(q).join(', ');
    const inner =
      `SELECT ${ROW}${idSelect ? `, ${idSelect}` : ''}, unnest([${periodList}]) AS "__period", ` +
      `unnest([${valueList}]) AS "__value", unnest([${ord}]) AS "__ord" FROM ${from}`;
    const sql =
      `SELECT row_number() OVER (ORDER BY ${ROW}, "__ord") AS ${ROW}${idSelect ? `, ${idSelect}` : ''}, ` +
      `"__period" AS ${quoteIdent(periodSql)}, "__value" AS ${quoteIdent(valueSql)} FROM (${inner})`;
    const periodCol: ColumnRef = {
      id: p.periodColumnId,
      sqlName: periodSql,
      displayName: periodDisplay,
      type: periodType,
      format: {
        timeGrainHint: p.periodParse === 'date' ? undefined : p.periodParse === 'month' && !isDate ? undefined : p.periodParse,
      },
    };
    const valueCol: ColumnRef = {
      id: p.valueColumnId,
      sqlName: valueSql,
      displayName: valueDisplay,
      type: allNumeric ? 'decimal' : 'varchar',
    };
    return { sql, columns: [...ids, periodCol, valueCol] };
  },
  describe: (p) => ({
    key: `etl.step.unpivot.describe.${p.periodParse}`,
    params: { count: p.valueColumnIds.length },
  }),
};

// ---------- castTypes ----------
export const castColumnSchema: z.ZodType<CastColumn> = z.object({
  columnId: z.string(),
  to: z.enum(['integer', 'decimal', 'boolean', 'date', 'datetime', 'text']),
  numberFormat: z
    .object({
      decimal: z.enum([',', '.', 'either']),
      thousands: z.enum(['.', ',', '']),
      percent: z.boolean().optional(),
      currency: z.string().optional(),
    })
    .optional(),
  dateFormats: z.array(z.string()).optional() as z.ZodType<DateFormatId[] | undefined>,
  booleanValues: z.object({ true: z.array(z.string()), false: z.array(z.string()) }).optional(),
  percent: z.boolean().optional(),
  currency: z.string().optional(),
  timeGrainHint: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
});

/** SQL converting one column according to a cast spec. Non-text sources are cast directly. */
export function castSql(c: ColumnRef, spec: CastColumn): string {
  const x = q(c);
  const fromText = isTextual(c);
  switch (spec.to) {
    case 'integer': {
      const n = fromText && spec.numberFormat ? numberCastSql(x, spec.numberFormat) : `TRY_CAST(${x} AS DOUBLE)`;
      return `CAST(round(${n}) AS BIGINT)`;
    }
    case 'decimal':
      return fromText && spec.numberFormat ? numberCastSql(x, spec.numberFormat) : `TRY_CAST(${x} AS DOUBLE)`;
    case 'boolean': {
      if (!fromText) return `TRY_CAST(${x} AS BOOLEAN)`;
      const t = spec.booleanValues?.true ?? ['true'];
      const f = spec.booleanValues?.false ?? ['false'];
      return `(CASE lower(trim(${x})) ${t.map((v) => `WHEN ${sqlLiteral(v)} THEN TRUE`).join(' ')} ${f.map((v) => `WHEN ${sqlLiteral(v)} THEN FALSE`).join(' ')} END)`;
    }
    case 'date':
    case 'datetime':
      if (!fromText) return spec.to === 'date' ? `TRY_CAST(${x} AS DATE)` : `TRY_CAST(${x} AS TIMESTAMP)`;
      return dateCastSql(x, spec.dateFormats ?? ['iso'], spec.to);
    case 'text':
      return fromText ? x : `CAST(${x} AS VARCHAR)`;
  }
}

export const castTypes: StepDefinition<{ columns: CastColumn[] }> = {
  kind: 'castTypes',
  measuresCells: true,
  paramsSchema: z.object({ columns: z.array(castColumnSchema) }),
  toSql: ({ from, columns }, p) => {
    const replace = new Map<string, string>();
    const specs = new Map(p.columns.map((s) => [s.columnId, s]));
    const next = columns.map((c) => {
      const spec = specs.get(c.id);
      if (!spec) return c.type === 'varchar' ? { ...c, type: 'text' as const } : c;
      replace.set(c.id, castSql(c, spec));
      return {
        ...c,
        type: spec.to,
        format: {
          ...c.format,
          unit: spec.percent ? ('percent' as const) : spec.currency ? ('currency' as const) : c.format?.unit,
          currency: spec.currency ?? c.format?.currency,
          timeGrainHint: spec.timeGrainHint ?? c.format?.timeGrainHint,
        },
      };
    });
    // Untyped columns without a spec become text.
    return { sql: `SELECT ${selectList(columns, replace)} FROM ${from}`, columns: next };
  },
  describe: (p, e) => ({
    key: 'etl.step.castTypes.describe',
    params: {
      numbers: p.columns.filter((c) => c.to === 'integer' || c.to === 'decimal').length,
      dates: p.columns.filter((c) => c.to === 'date' || c.to === 'datetime').length,
      failed: e?.cellsChanged ?? 0,
    },
  }),
};

// ---------- standardizeCategories ----------
export const standardizeCategories: StepDefinition<{ columnId: string; mapping: Record<string, string> }> = {
  kind: 'standardizeCategories',
  measuresCells: true,
  paramsSchema: z.object({ columnId: z.string(), mapping: z.record(z.string(), z.string()) }),
  toSql: ({ from, columns }, p) => {
    const c = col(columns, p.columnId);
    const entries = Object.entries(p.mapping);
    const replace = new Map<string, string>();
    if (entries.length) {
      replace.set(c.id, `(CASE ${q(c)} ${entries.map(([a, b]) => `WHEN ${sqlLiteral(a)} THEN ${sqlLiteral(b)}`).join(' ')} ELSE ${q(c)} END)`);
    }
    return { sql: `SELECT ${selectList(columns, replace)} FROM ${from}`, columns };
  },
  describe: (p) => {
    const entries = Object.entries(p.mapping);
    return {
      key: 'etl.step.standardizeCategories.describe',
      params: {
        count: entries.length,
        example: entries.length ? `"${entries[0][0]}" → "${entries[0][1]}"` : '',
      },
    };
  },
};

// ---------- filterRows ----------
export const filterRows: StepDefinition<{ clauses: FilterClause[]; mode: 'keep' | 'remove' }> = {
  kind: 'filterRows',
  paramsSchema: z.object({ clauses: z.array(filterClauseSchema).min(1), mode: z.enum(['keep', 'remove']) }),
  toSql: ({ from, columns }, p) => {
    const cond = p.clauses.map((cl) => filterClauseSql(cl, col(columns, cl.columnId))).join(' AND ');
    return {
      sql: `SELECT ${selectList(columns)} FROM ${from} WHERE ${p.mode === 'keep' ? `(${cond})` : `NOT coalesce((${cond}), FALSE)`}`,
      columns,
    };
  },
  describe: (p, e) => ({
    key: p.mode === 'keep' ? 'etl.step.filterRows.keep' : 'etl.step.filterRows.remove',
    params: { count: e ? e.rowsBefore - e.rowsAfter : 0 },
  }),
};

// ---------- calculatedColumn ----------
export const calculatedColumn: StepDefinition<{ displayName: string; expression: string; columnId: string }> = {
  kind: 'calculatedColumn',
  paramsSchema: z.object({ displayName: z.string().min(1).max(200), expression: z.string().min(1).max(2000), columnId: z.string() }),
  toSql: ({ from, columns, locale }, p) => {
    let compiled;
    try {
      compiled = compileExpression(p.expression, columns, locale);
    } catch (err) {
      const e = err as { key?: string; params?: Record<string, string | number> };
      throw new StepError(e.key ?? 'invalidExpression', e.params ?? {});
    }
    const type = resultColumnType(compiled.type);
    const sqlName = freshSqlName(p.displayName, columns.filter((c) => c.id !== p.columnId));
    const others = columns.filter((c) => c.id !== p.columnId);
    return {
      sql: `SELECT ${selectList(others)}, ${compiled.sql} AS ${quoteIdent(sqlName)} FROM ${from}`,
      columns: [...others, { id: p.columnId, sqlName, displayName: p.displayName, type }],
    };
  },
  describe: (p) => ({ key: 'etl.step.calculatedColumn.describe', params: { name: p.displayName } }),
};

// ---------- splitColumn ----------
export const splitColumn: StepDefinition<{ columnId: string; delimiter: string; parts: number; names: string[]; columnIds: string[] }> = {
  kind: 'splitColumn',
  paramsSchema: z.object({
    columnId: z.string(),
    delimiter: z.string().min(1).max(10),
    parts: z.number().int().min(2).max(20),
    names: z.array(z.string()),
    columnIds: z.array(z.string()),
  }),
  toSql: ({ from, columns }, p) => {
    const c = col(columns, p.columnId);
    const names = Array.from({ length: p.parts }, (_, i) => p.names[i] || `${c.displayName} ${i + 1}`);
    const sqlNames = uniqueSqlNames(names, columns.map((x) => x.sqlName));
    const parts = names.map(
      (_, i) => `nullif(trim(split_part(CAST(${q(c)} AS VARCHAR), ${sqlLiteral(p.delimiter)}, ${i + 1})), '') AS ${quoteIdent(sqlNames[i])}`,
    );
    return {
      sql: `SELECT ${selectList(columns)}, ${parts.join(', ')} FROM ${from}`,
      columns: [
        ...columns,
        ...names.map((n, i) => ({ id: p.columnIds[i] ?? `${p.columnId}_part${i + 1}`, sqlName: sqlNames[i], displayName: n, type: 'varchar' as const })),
      ],
    };
  },
  describe: (p) => ({ key: 'etl.step.splitColumn.describe', params: { parts: p.parts, delimiter: p.delimiter } }),
};

// ---------- replaceValues ----------
export const replaceValues: StepDefinition<{ columnId: string; find: string; replace: string; matchWhole: boolean }> = {
  kind: 'replaceValues',
  measuresCells: true,
  paramsSchema: z.object({ columnId: z.string(), find: z.string().min(1), replace: z.string(), matchWhole: z.boolean() }),
  toSql: ({ from, columns }, p) => {
    const c = col(columns, p.columnId);
    const x = isTextual(c) ? q(c) : `CAST(${q(c)} AS VARCHAR)`;
    const expr = p.matchWhole
      ? `(CASE WHEN ${x} = ${sqlLiteral(p.find)} THEN ${sqlLiteral(p.replace)} ELSE ${x} END)`
      : `replace(${x}, ${sqlLiteral(p.find)}, ${sqlLiteral(p.replace)})`;
    return {
      sql: `SELECT ${selectList(columns, new Map([[c.id, `nullif(${expr}, '')`]]))} FROM ${from}`,
      columns: columns.map((x2) => (x2.id === c.id && !isTextual(c) ? { ...x2, type: 'varchar' as const } : x2)),
    };
  },
  describe: (p, e) => ({
    key: 'etl.step.replaceValues.describe',
    params: { find: p.find, replace: p.replace, cells: e?.cellsChanged ?? 0 },
  }),
};

// ---------- customSql ----------
/** Validates user SQL: one SELECT/WITH statement using {{input}} (9.3). */
export function checkCustomSql(sql: string): string {
  const stripped = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(stripped)) throw new StepError('customSql.notSelect');
  if (stripped.includes(';')) throw new StepError('customSql.multipleStatements');
  if (!stripped.includes('{{input}}')) throw new StepError('customSql.noInput');
  return stripped;
}

export const customSql: StepDefinition<{ sql: string }> = {
  kind: 'customSql',
  paramsSchema: z.object({ sql: z.string().min(1).max(20000) }),
  toSql: ({ from, columns }, p) => {
    const body = checkCustomSql(p.sql).split('{{input}}').join(from);
    // Columns are resolved by the pipeline runner with DESCRIBE.
    return { sql: body, columns };
  },
  describe: () => ({ key: 'etl.step.customSql.describe', params: {} }),
};
