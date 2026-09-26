import { z } from 'zod';
import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import { uniqueSqlNames } from '../slugify';
import type { Described, StepDefinition } from '../types';
import { ROW, col, isEmptySql, isTextual, q, selectList } from './helpers';

export const skipRows: StepDefinition<{ count: number }> = {
  kind: 'skipRows',
  paramsSchema: z.object({ count: z.number().int().min(0) }),
  toSql: ({ from, columns }, p) => ({
    sql: `SELECT ${selectList(columns)} FROM ${from} QUALIFY row_number() OVER (ORDER BY ${ROW}) > ${p.count}`,
    columns,
  }),
  describe: (p) => ({ key: 'etl.step.skipRows.describe', params: { count: p.count } }),
};

export interface PromoteHeaderParams {
  /** __row of the header row, or null when the data has no header (generated names). */
  row: number | null;
  /** Header values captured when the step was created (refreshed on every run). */
  names: string[];
  skipped?: number;
}

export const promoteHeader: StepDefinition<PromoteHeaderParams> = {
  kind: 'promoteHeader',
  paramsSchema: z.object({ row: z.number().int().nullable(), names: z.array(z.string()), skipped: z.number().int().optional() }),
  toSql: ({ from, columns, locale }, p) => {
    const generic = locale === 'fi' ? 'Sarake' : 'Column';
    const displayNames = columns.map((c, i) => {
      const name = p.names[i]?.trim();
      return name ? name : `${generic} ${i + 1}`;
    });
    const sqlNames = uniqueSqlNames(displayNames);
    const next = columns.map((c, i) => ({ ...c, displayName: displayNames[i], sqlName: sqlNames[i] }));
    const select = [ROW, ...columns.map((c, i) => `${q(c)} AS ${quoteIdent(sqlNames[i])}`)].join(', ');
    return {
      sql: `SELECT ${select} FROM ${from}${p.row !== null ? ` WHERE ${ROW} <> ${sqlLiteral(p.row)}` : ''}`,
      columns: next,
    };
  },
  describe: (p): Described =>
    p.row === null
      ? { key: 'etl.step.promoteHeader.none', params: {} }
      : { key: 'etl.step.promoteHeader.describe', params: { row: p.row, skipped: p.skipped ?? 0 } },
};

export const dropEmptyRows: StepDefinition<Record<string, never>> = {
  kind: 'dropEmptyRows',
  paramsSchema: z.object({}).strict() as unknown as z.ZodType<Record<string, never>>,
  toSql: ({ from, columns }) => ({
    sql: `SELECT ${selectList(columns)} FROM ${from}${columns.length ? ` WHERE NOT (${columns.map(isEmptySql).join(' AND ')})` : ''}`,
    columns,
  }),
  describe: (_p, e) => ({ key: 'etl.step.dropEmptyRows.describe', params: { count: e ? e.rowsBefore - e.rowsAfter : 0 } }),
};

export const dropEmptyColumns: StepDefinition<{ columnIds: string[] }> = {
  kind: 'dropEmptyColumns',
  paramsSchema: z.object({ columnIds: z.array(z.string()) }),
  toSql: ({ from, columns }, p) => {
    const drop = new Set(p.columnIds);
    const kept = columns.filter((c) => !drop.has(c.id));
    return { sql: `SELECT ${selectList(kept)} FROM ${from}`, columns: kept };
  },
  describe: (p) => ({ key: 'etl.step.dropEmptyColumns.describe', params: { count: p.columnIds.length } }),
};

export const trimWhitespace: StepDefinition<{ columnIds: string[] }> = {
  kind: 'trimWhitespace',
  measuresCells: true,
  paramsSchema: z.object({ columnIds: z.array(z.string()) }),
  toSql: ({ from, columns }, p) => {
    const replace = new Map<string, string>();
    for (const id of p.columnIds) {
      const c = col(columns, id);
      if (isTextual(c)) replace.set(id, `nullif(regexp_replace(trim(${q(c)}), '\\s+', ' ', 'g'), '')`);
    }
    return { sql: `SELECT ${selectList(columns, replace)} FROM ${from}`, columns };
  },
  describe: (p, e) => ({
    key: 'etl.step.trimWhitespace.describe',
    params: { columns: p.columnIds.length, cells: e?.cellsChanged ?? 0 },
  }),
};

export const removeTotalRows: StepDefinition<{ rowNumbers: number[]; reason: 'keyword' | 'sum'; label?: string }> = {
  kind: 'removeTotalRows',
  paramsSchema: z.object({
    rowNumbers: z.array(z.number().int()),
    reason: z.enum(['keyword', 'sum']),
    label: z.string().optional(),
  }),
  toSql: ({ from, columns }, p) => ({
    sql: `SELECT ${selectList(columns)} FROM ${from}${p.rowNumbers.length ? ` WHERE ${ROW} NOT IN (${p.rowNumbers.map((n) => sqlLiteral(n)).join(', ')})` : ''}`,
    columns,
  }),
  describe: (p) => ({
    key: p.label ? 'etl.step.removeTotalRows.describe' : 'etl.step.removeTotalRows.describeSum',
    params: { count: p.rowNumbers.length, label: p.label ?? '' },
  }),
};

export const fillDown: StepDefinition<{ columnIds: string[] }> = {
  kind: 'fillDown',
  measuresCells: true,
  paramsSchema: z.object({ columnIds: z.array(z.string()) }),
  toSql: ({ from, columns }, p) => {
    const replace = new Map<string, string>();
    for (const id of p.columnIds) {
      const c = col(columns, id);
      replace.set(id, `last_value(${q(c)} IGNORE NULLS) OVER (ORDER BY ${ROW} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`);
    }
    return { sql: `SELECT ${selectList(columns, replace)} FROM ${from}`, columns };
  },
  describe: (p, e) => ({
    key: 'etl.step.fillDown.describe',
    params: { columns: p.columnIds.length, cells: e?.cellsChanged ?? 0 },
  }),
};

export const dedupe: StepDefinition<{ columnIds?: string[] }> = {
  kind: 'dedupe',
  paramsSchema: z.object({ columnIds: z.array(z.string()).optional() }),
  toSql: ({ from, columns }, p) => {
    const keys = p.columnIds?.length ? p.columnIds.map((id) => col(columns, id)) : columns;
    const partition = keys.length ? keys.map(q).join(', ') : '1';
    return {
      sql: `SELECT ${selectList(columns)} FROM ${from} QUALIFY row_number() OVER (PARTITION BY ${partition} ORDER BY ${ROW}) = 1`,
      columns,
    };
  },
  describe: (_p, e) => ({ key: 'etl.step.dedupe.describe', params: { count: e ? e.rowsBefore - e.rowsAfter : 0 } }),
};

export const renameColumn: StepDefinition<{ columnId: string; displayName: string }> = {
  kind: 'renameColumn',
  paramsSchema: z.object({ columnId: z.string(), displayName: z.string().min(1).max(200) }),
  toSql: ({ from, columns }, p) => {
    const target = col(columns, p.columnId);
    return {
      sql: `SELECT ${selectList(columns)} FROM ${from}`,
      columns: columns.map((c) => (c.id === target.id ? { ...c, displayName: p.displayName } : c)),
    };
  },
  describe: (p) => ({ key: 'etl.step.renameColumn.describe', params: { name: p.displayName } }),
};

export const dropColumn: StepDefinition<{ columnId: string; name?: string; reason?: 'total' }> = {
  kind: 'dropColumn',
  paramsSchema: z.object({ columnId: z.string(), name: z.string().optional(), reason: z.literal('total').optional() }),
  toSql: ({ from, columns }, p) => {
    col(columns, p.columnId);
    const kept = columns.filter((c) => c.id !== p.columnId);
    return { sql: `SELECT ${selectList(kept)} FROM ${from}`, columns: kept };
  },
  describe: (p) => ({
    key: p.reason === 'total' ? 'etl.step.dropColumn.total' : 'etl.step.dropColumn.describe',
    params: { name: p.name ?? '' },
  }),
};

export const sortRows: StepDefinition<{ by: Array<{ columnId: string; dir: 'asc' | 'desc' }> }> = {
  kind: 'sortRows',
  paramsSchema: z.object({ by: z.array(z.object({ columnId: z.string(), dir: z.enum(['asc', 'desc']) })).min(1) }),
  toSql: ({ from, columns }, p) => {
    const order = p.by.map((b) => `${q(col(columns, b.columnId))} ${b.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`).join(', ');
    return {
      sql: `SELECT row_number() OVER (ORDER BY ${order}, ${ROW}) AS ${ROW}, ${columns.map(q).join(', ') || '1 AS "_"'} FROM ${from}`,
      columns,
    };
  },
  describe: (p) => ({ key: 'etl.step.sortRows.describe', params: { count: p.by.length } }),
};
