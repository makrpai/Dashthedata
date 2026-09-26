import type { CastColumn } from '@/lib/profile/inferType';
import { newId } from '@/lib/util/id';
import type { ColumnType, PipelineStep } from '@/types/domain';
import type { ColumnRef } from './types';

export function userStep(kind: PipelineStep['kind'], params: Record<string, unknown>): PipelineStep {
  return { id: newId('st'), kind, params, origin: 'user', enabled: true };
}

/** Default cast spec when the user picks a type by hand. */
function manualCast(columnId: string, to: ColumnType): CastColumn {
  if (to === 'integer' || to === 'decimal') return { columnId, to, numberFormat: { decimal: 'either', thousands: '' } };
  if (to === 'date' || to === 'datetime') return { columnId, to, dateFormats: ['iso', 'dotted', 'dmy', 'excelSerial'] };
  if (to === 'boolean') {
    return { columnId, to, booleanValues: { true: ['true', 'kyllä', 'yes', 'k', 'y', '1', 'tosi', 'joo'], false: ['false', 'ei', 'no', 'e', 'n', '0', 'epätosi'] } };
  }
  return { columnId, to };
}

/**
 * Changes a column's type: edits the castTypes step if the column existed before it, otherwise
 * appends a new castTypes step for that column.
 */
export function withTypeOverride(
  steps: PipelineStep[],
  columnsBefore: (index: number) => ColumnRef[],
  columnId: string,
  to: ColumnType,
): PipelineStep[] {
  const idx = steps.findIndex((s) => s.kind === 'castTypes' && s.enabled && !s.suggested);
  if (idx >= 0 && columnsBefore(idx).some((c) => c.id === columnId)) {
    const step = steps[idx];
    const cols = ((step.params.columns as CastColumn[]) ?? []).filter((c) => c.columnId !== columnId);
    return steps.map((s, i) => (i === idx ? { ...s, params: { ...s.params, columns: [...cols, manualCast(columnId, to)] } } : s));
  }
  return [...steps, userStep('castTypes', { columns: [manualCast(columnId, to)] })];
}

/** Flips an ambiguous interpretation (D/M ↔ M/D dates, decimal comma ↔ dot). */
export function withReinterpretation(steps: PipelineStep[], columnId: string): PipelineStep[] {
  return steps.map((s) => {
    if (s.kind !== 'castTypes') return s;
    const cols = (s.params.columns as CastColumn[]) ?? [];
    if (!cols.some((c) => c.columnId === columnId)) return s;
    const next = cols.map((c) => {
      if (c.columnId !== columnId) return c;
      if (c.dateFormats?.some((f) => f === 'dmy' || f === 'mdy')) {
        return { ...c, dateFormats: c.dateFormats.map((f) => (f === 'dmy' ? 'mdy' : f === 'mdy' ? 'dmy' : f)) };
      }
      if (c.numberFormat) {
        const nf = c.numberFormat;
        return {
          ...c,
          numberFormat:
            nf.decimal === ','
              ? { ...nf, decimal: '.' as const, thousands: nf.thousands === '.' ? ('' as const) : (',' as const) }
              : { ...nf, decimal: ',' as const, thousands: nf.thousands === ',' ? ('' as const) : ('.' as const) },
        };
      }
      return c;
    });
    const warnings = { ...((s.params.warnings as Record<string, unknown>) ?? {}) };
    delete warnings[columnId];
    return { ...s, params: { ...s.params, columns: next, warnings } };
  });
}
