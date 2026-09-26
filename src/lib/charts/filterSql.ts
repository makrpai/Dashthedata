import { likeEscape, quoteIdent, sqlList, sqlLiteral } from '@/lib/duckdb/sql';
import type { ColumnType, FilterClause, TimeGrain } from '@/types/domain';

export interface FilterColumn {
  sqlName: string;
  type: ColumnType | 'varchar';
  /** Optional table/alias qualifier. */
  qualifier?: string;
}

type Scalar = string | number;

function literalFor(value: Scalar | boolean, type: FilterColumn['type']): string {
  if (typeof value === 'boolean') return sqlLiteral(value);
  if (type === 'integer' || type === 'decimal') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? sqlLiteral(n) : 'NULL';
  }
  if (type === 'date') return `CAST(${sqlLiteral(String(value))} AS DATE)`;
  if (type === 'datetime') return `CAST(${sqlLiteral(String(value))} AS TIMESTAMP)`;
  if (type === 'boolean') return sqlLiteral(String(value) === 'true');
  return sqlLiteral(String(value));
}

/** SQL for one clause (11.2). The value "__blank__" / null matches NULL in eq/in. */
export function filterClauseSql(clause: FilterClause, column: FilterColumn, grain?: TimeGrain): string {
  const base = column.qualifier ? `${quoteIdent(column.qualifier)}.${quoteIdent(column.sqlName)}` : quoteIdent(column.sqlName);
  const g = grain ?? clause.timeGrain;
  const col = g && (column.type === 'date' || column.type === 'datetime') ? `CAST(date_trunc(${sqlLiteral(g)}, ${base}) AS DATE)` : base;
  const type = g ? 'date' : column.type;
  const v = clause.value;
  const isBlank = (x: unknown) => x === null || x === '__blank__';
  switch (clause.op) {
    case 'isNull':
      return `${col} IS NULL`;
    case 'notNull':
      return `${col} IS NOT NULL`;
    case 'eq':
      if (isBlank(v)) return `${col} IS NULL`;
      return `${col} = ${literalFor(v as Scalar, type)}`;
    case 'neq':
      if (isBlank(v)) return `${col} IS NOT NULL`;
      return `(${col} IS DISTINCT FROM ${literalFor(v as Scalar, type)})`;
    case 'gt':
      return `${col} > ${literalFor(v as Scalar, type)}`;
    case 'gte':
      return `${col} >= ${literalFor(v as Scalar, type)}`;
    case 'lt':
      return `${col} < ${literalFor(v as Scalar, type)}`;
    case 'lte':
      return `${col} <= ${literalFor(v as Scalar, type)}`;
    case 'between': {
      const [a, b] = Array.isArray(v) ? v : [];
      const parts: string[] = [];
      if (a !== undefined && a !== null && a !== '') parts.push(`${col} >= ${literalFor(a, type)}`);
      if (b !== undefined && b !== null && b !== '') parts.push(`${col} <= ${literalFor(b, type)}`);
      return parts.length ? `(${parts.join(' AND ')})` : 'TRUE';
    }
    case 'contains':
      return `CAST(${col} AS VARCHAR) ILIKE ${sqlLiteral(`%${likeEscape(String(v ?? ''))}%`)} ESCAPE '\\'`;
    case 'in':
    case 'notIn': {
      const values = (Array.isArray(v) ? v : v === undefined ? [] : [v]) as Scalar[];
      const blanks = values.some(isBlank);
      const rest = values.filter((x) => !isBlank(x));
      const list = rest.length ? `${col} IN (${rest.map((x) => literalFor(x, type)).join(', ')})` : 'FALSE';
      const inSql = blanks ? `(${list} OR ${col} IS NULL)` : list;
      return clause.op === 'in' ? inSql : `NOT (${inSql})`;
    }
    default:
      return 'TRUE';
  }
}

export { sqlList };
