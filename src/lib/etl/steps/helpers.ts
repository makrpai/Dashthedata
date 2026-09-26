import { quoteIdent } from '@/lib/duckdb/sql';
import { StepError, type ColumnRef } from '../types';

export const ROW = '"__row"';

export function col(columns: ColumnRef[], id: string): ColumnRef {
  const c = columns.find((x) => x.id === id);
  if (!c) throw new StepError('missingColumn', { id });
  return c;
}

export const q = (c: ColumnRef) => quoteIdent(c.sqlName);

/** SELECT list with optional per-column replacement expressions. */
export function selectList(columns: ColumnRef[], replace: Map<string, string> = new Map()): string {
  return [ROW, ...columns.map((c) => (replace.has(c.id) ? `${replace.get(c.id)} AS ${q(c)}` : q(c)))].join(', ');
}

export const isTextual = (c: ColumnRef) => c.type === 'varchar' || c.type === 'text';

/** Expression that is true when a cell is empty (NULL, or blank text). */
export function isEmptySql(c: ColumnRef): string {
  return isTextual(c) ? `coalesce(trim(${q(c)}), '') = ''` : `${q(c)} IS NULL`;
}
