/**
 * SQL building helpers. Every identifier goes through quoteIdent() and every literal through
 * sqlLiteral(); user text is never concatenated into SQL directly.
 */

/** Quotes an identifier: wraps in double quotes and doubles embedded quotes. */
export function quoteIdent(name: string): string {
  if (typeof name !== 'string' || name.length === 0) throw new Error('Identifier must be a non-empty string');
  if (name.includes('\u0000')) throw new Error('Identifier must not contain NUL');
  return `"${name.replace(/"/g, '""')}"`;
}

export type SqlScalar = string | number | boolean | null | undefined | bigint;

/** Renders a literal. Strings double single quotes; numbers must be finite. */
export function sqlLiteral(value: SqlScalar): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number cannot be a SQL literal: ${value}`);
    return String(value);
  }
  if (typeof value === 'string') {
    if (value.includes('\u0000')) throw new Error('String literal must not contain NUL');
    return `'${value.replace(/'/g, "''")}'`;
  }
  throw new Error(`Unsupported literal type: ${typeof value}`);
}

/** `(lit1, lit2, …)` for IN lists. Empty lists become `(NULL)` so the SQL stays valid. */
export function sqlList(values: readonly SqlScalar[]): string {
  if (values.length === 0) return '(NULL)';
  return `(${values.map(sqlLiteral).join(', ')})`;
}

/** Escapes a string for use inside a LIKE pattern with ESCAPE '\\'. */
export function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Qualified reference `"table"."column"`. */
export function qualified(table: string, column: string): string {
  return `${quoteIdent(table)}.${quoteIdent(column)}`;
}
