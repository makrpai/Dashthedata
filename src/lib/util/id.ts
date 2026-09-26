import { customAlphabet } from 'nanoid';

// Lowercase alphanumerics only: ids end up in DuckDB table names and must be safe unquoted.
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const make = customAlphabet(alphabet, 8);

export function newId(prefix = ''): string {
  return prefix ? `${prefix}_${make()}` : make();
}

export const newColumnId = () => newId('col');
