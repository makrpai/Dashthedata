import type { CellValue } from './types';

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** Formats a UTC epoch-millisecond value as `YYYY-MM-DD`. */
export function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Formats a UTC epoch-millisecond value as `YYYY-MM-DDTHH:mm:ss`. */
export function isoDateTime(ms: number): string {
  const d = new Date(ms);
  return `${isoDate(ms)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** bigint → number when safe, otherwise a decimal string. */
export function bigintToJs(value: bigint): number | string {
  const n = Number(value);
  return Number.isSafeInteger(n) || Math.abs(n) < 2 ** 63 ? n : value.toString();
}

export type LogicalKind = 'date' | 'timestamp' | 'other';

/** Normalises a driver value to a plain JS cell: numbers, strings, booleans or null. */
export function normalizeValue(value: unknown, kind: LogicalKind = 'other'): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') {
    const v = bigintToJs(value);
    return typeof v === 'number' ? v : v;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) return null;
    return kind === 'date' ? isoDate(ms) : isoDateTime(ms);
  }
  if (typeof value === 'number') {
    if (kind === 'date') return isoDate(value);
    if (kind === 'timestamp') return isoDateTime(value);
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  return String(value);
}
