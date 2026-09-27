const FORBIDDEN = /\b(insert|update|delete|drop|alter|attach|copy|pragma|install|create|grant|revoke|call|execute|load|detach|export|import)\b/i;

/** Allows a single read-only SELECT/WITH statement. */
export function assertSelectOnly(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/g, '');
  if (!trimmed) throw new Error('SQL is empty');
  if (trimmed.includes(';')) throw new Error('Only one SQL statement is allowed');
  if (/--|\/\*|\*\//.test(trimmed)) throw new Error('SQL comments are not allowed');
  if (!/^(select|with)\b/i.test(trimmed)) throw new Error('Only SELECT queries are allowed');
  if (FORBIDDEN.test(trimmed)) throw new Error('Only read-only queries are allowed');
  return trimmed;
}
