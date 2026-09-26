import type { z } from 'zod';
import type { QueryRunner } from '@/lib/duckdb/types';
import type { ColumnType, Locale, StepEffect, StepKind } from '@/types/domain';

/** A column as seen by a pipeline step. `varchar` = raw text that has not been typed yet. */
export interface ColumnRef {
  id: string;
  sqlName: string;
  displayName: string;
  type: ColumnType | 'varchar';
  /** Format metadata produced by castTypes (currency, percent, time grain hint). */
  format?: { unit?: 'currency' | 'percent'; currency?: string; timeGrainHint?: 'day' | 'week' | 'month' | 'quarter' | 'year' };
}

export interface StepInput {
  /** Quoted name of the previous view. */
  from: string;
  columns: ColumnRef[];
  locale: Locale;
}

export interface StepOutput {
  sql: string;
  columns: ColumnRef[];
}

export interface Described {
  key: string;
  params: Record<string, string | number>;
}

export interface StepDefinition<P> {
  kind: StepKind;
  paramsSchema: z.ZodType<P>;
  /** SELECT reading the previous view. Throws StepError for invalid references. */
  toSql(input: StepInput, params: P): StepOutput;
  /** Plain-language description computed from params (never stored as text). */
  describe(params: P, effect?: StepEffect): Described;
  /** Whether cellsChanged is cheap to compute by comparing with the previous view on __row. */
  measuresCells?: boolean;
}

export class StepError extends Error {
  constructor(
    readonly code: string,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code);
  }
}

export interface DetectContext {
  runner: QueryRunner;
  /** Quoted view name holding the pipeline result so far. */
  from: string;
  columns: ColumnRef[];
  rowCount: number;
  locale: Locale;
  dataLocale: 'fi' | 'en';
  /** Source hints. */
  typedAtSource: boolean;
  mergedColumnIds: string[];
  sheetName?: string;
  datasetName: string;
  notes: string[];
  /** Excel/JSON cells are canonical (dot decimal). */
  canonicalNumbers: boolean;
}

export interface Proposal {
  kind: StepKind;
  params: Record<string, unknown>;
  confidence: number;
  /** Auto-apply threshold for this proposal (9.2); below it the step is a suggestion. */
  threshold: number;
  /** Extra notes for the dataset (skipped title rows). */
  notes?: string[];
}
