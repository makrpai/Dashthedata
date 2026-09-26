import type { StepKind } from '@/types/domain';
import type { StepDefinition } from '../types';
import {
  castTypes,
  calculatedColumn,
  customSql,
  filterRows,
  replaceValues,
  splitColumn,
  standardizeCategories,
  unpivot,
} from './advanced';
import {
  dedupe,
  dropColumn,
  dropEmptyColumns,
  dropEmptyRows,
  fillDown,
  promoteHeader,
  removeTotalRows,
  renameColumn,
  skipRows,
  sortRows,
  trimWhitespace,
} from './basic';

/** Registry of every step type (9.3). */
export const STEPS: Record<StepKind, StepDefinition<never>> = {
  skipRows,
  promoteHeader,
  dropEmptyRows,
  dropEmptyColumns,
  trimWhitespace,
  removeTotalRows,
  fillDown,
  unpivot,
  castTypes,
  standardizeCategories,
  dedupe,
  renameColumn,
  dropColumn,
  filterRows,
  calculatedColumn,
  splitColumn,
  replaceValues,
  sortRows,
  customSql,
} as unknown as Record<StepKind, StepDefinition<never>>;

export function stepDefinition(kind: StepKind): StepDefinition<unknown> {
  return STEPS[kind] as unknown as StepDefinition<unknown>;
}
