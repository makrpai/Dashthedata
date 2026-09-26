import type { QueryRunner } from '@/lib/duckdb/types';
import { newId } from '@/lib/util/id';
import type { Locale, PipelineStep } from '@/types/domain';
import { runPipeline, type BaseInput } from '../pipeline';
import type { DetectContext, Proposal } from '../types';
import { detectCategories } from './categories';
import { detectTypes } from './castTypes';
import { detectFillDown } from './fillDown';
import { detectHeader } from './header';
import { detectDuplicates, detectEmptyColumns, detectEmptyRows, detectTrim } from './simple';
import { detectTotals } from './totals';
import { detectUnpivot } from './unpivot';

type Detector = (ctx: DetectContext) => Promise<Proposal[]>;

/** Detection order (9.2). Typed sources only run the steps that matter for them (7.5). */
const UNTYPED: Detector[] = [
  detectEmptyColumns,
  detectEmptyRows,
  detectHeader,
  detectTrim,
  detectTotals,
  detectFillDown,
  detectUnpivot,
  detectTypes,
  detectCategories,
  detectDuplicates,
];
const TYPED: Detector[] = [detectTrim, detectTypes, detectCategories, detectDuplicates];

export interface AutoDetectOptions {
  datasetId: string;
  datasetName: string;
  base: BaseInput;
  locale: Locale;
  dataLocale: 'fi' | 'en';
  typedAtSource: boolean;
  mergedColumnIds: string[];
  sheetName?: string;
  canonicalNumbers: boolean;
}

/**
 * Runs the auto-detections once for a new dataset. Each detection sees the result of the steps
 * before it. Proposals above their threshold are enabled; the rest become suggestions.
 */
export async function autoDetect(runner: QueryRunner, opts: AutoDetectOptions): Promise<{ steps: PipelineStep[]; notes: string[] }> {
  const steps: PipelineStep[] = [];
  const notes: string[] = [];
  for (const detect of opts.typedAtSource ? TYPED : UNTYPED) {
    const run = await runPipeline(runner, { datasetId: opts.datasetId, base: opts.base, steps, locale: opts.locale });
    const ctx: DetectContext = {
      runner,
      from: run.lastView,
      columns: run.columns,
      rowCount: run.rowCount,
      locale: opts.locale,
      dataLocale: opts.dataLocale,
      typedAtSource: opts.typedAtSource,
      mergedColumnIds: opts.mergedColumnIds,
      sheetName: opts.sheetName,
      datasetName: opts.datasetName,
      notes,
      canonicalNumbers: opts.canonicalNumbers,
    };
    let proposals: Proposal[] = [];
    try {
      proposals = await detect(ctx);
    } catch (err) {
      console.warn('[autoDetect] detector failed', err instanceof Error ? err.message : err);
    }
    for (const p of proposals) {
      if (p.notes) notes.push(...p.notes);
      const auto = p.confidence >= p.threshold;
      steps.push({
        id: newId('st'),
        kind: p.kind,
        params: p.params,
        origin: 'auto',
        enabled: auto,
        suggested: !auto,
        confidence: Math.round(p.confidence * 100) / 100,
      });
    }
  }
  return { steps, notes };
}
