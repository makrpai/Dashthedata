import type { ColumnRole, ColumnStats, ColumnType, TimeGrain } from '@/types/domain';

const ID_HEADER_RE = /(^|[^a-zäö])(id|tunnus|numero|nro|no\.|koodi|code|key|avain)([^a-zäö]|$)|_id$|id$/i;

export interface RoleInput {
  type: ColumnType;
  displayName: string;
  stats: Pick<ColumnStats, 'count' | 'nulls' | 'distinct'>;
  rowCount: number;
  timeGrainHint?: TimeGrain;
  /** Average and spread of value length for text columns. */
  avgLength?: number;
  lengthStddev?: number;
}

/** Column roles (8.5), first match wins. */
export function inferRole(input: RoleInput): ColumnRole {
  const nonNull = Math.max(0, input.stats.count - input.stats.nulls);
  const uniq = nonNull > 0 ? input.stats.distinct / nonNull : 0;
  if (input.type === 'date' || input.type === 'datetime') return 'time';
  if (input.type === 'integer' && input.timeGrainHint === 'year') return 'time';
  if (uniq >= 0.95 && ID_HEADER_RE.test(input.displayName) && nonNull > 1) return 'id';
  if (
    input.type === 'text' &&
    uniq >= 0.98 &&
    nonNull > 10 &&
    (input.lengthStddev ?? Infinity) <= 1 &&
    (input.avgLength ?? 99) <= 40
  )
    return 'id';
  if (input.type === 'integer' || input.type === 'decimal') return 'measure';
  if (input.type === 'boolean') return 'dimension';
  if (
    input.type === 'text' &&
    input.stats.distinct <= Math.max(50, 0.05 * input.rowCount) &&
    (input.avgLength ?? 0) <= 40
  )
    return 'dimension';
  return 'text';
}
