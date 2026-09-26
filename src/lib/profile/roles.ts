import type { ColumnRole, ColumnStats, ColumnType, TimeGrain } from '@/types/domain';

/** Names that are identifiers even when values repeat (foreign keys such as asiakas_id). */
const KEY_NAME_RE = /(^|[_\s.-])(id|tunnus|nro|koodi|code|key|avain)$|^(id|nro)$/i;
const ID_HEADER_RE = /(tunnus|numero|nro|koodi|code|avain)|(^|[^a-zäö])(id|no\.|key)([^a-zäö]|$)|_id$/i;

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
  if ((input.type === 'integer' || input.type === 'text') && KEY_NAME_RE.test(input.displayName.trim())) return 'id';
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
