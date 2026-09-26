import type { DetectContext, Proposal } from '../types';
import { fetchRows, isEmpty, isNumberOrDate } from './common';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface HeaderScore {
  index: number;
  filled: number;
  textRatio: number;
  unique: number;
  belowNumeric: number;
  score: number;
}

/** Scores the first 30 rows as header candidates (9.4.1). Pure, exported for tests. */
export function scoreHeaderRows(rows: Array<Array<string | null>>): HeaderScore[] {
  const sample = rows.slice(0, 30);
  const width = sample.reduce((w, r) => {
    let last = -1;
    r.forEach((v, i) => {
      if (!isEmpty(v)) last = i;
    });
    return Math.max(w, last + 1);
  }, 0);
  const numericShare = (r: Array<string | null>) => {
    const cells = r.filter((v): v is string => !isEmpty(v));
    return cells.length ? cells.filter(isNumberOrDate).length / cells.length : 0;
  };
  return sample.map((r, index) => {
    const cells = r.filter((v): v is string => !isEmpty(v)).map((v) => v.trim());
    const filled = width ? cells.length / width : 0;
    const textRatio = cells.length ? cells.filter((v) => !isNumberOrDate(v)).length / cells.length : 0;
    const unique = cells.length ? new Set(cells.map((v) => v.toLowerCase())).size / cells.length : 0;
    const below = sample.slice(index + 1, index + 11);
    const belowShare = below.length
      ? below.reduce((s, b) => s + numericShare(b) * b.filter((v) => !isEmpty(v)).length, 0) /
        Math.max(1, below.reduce((s, b) => s + b.filter((v) => !isEmpty(v)).length, 0))
      : 0;
    const belowNumeric = belowShare - numericShare(r);
    const score = 0.35 * filled + 0.3 * textRatio + 0.15 * unique + 0.2 * clamp(belowNumeric, 0, 1);
    return { index, filled, textRatio, unique, belowNumeric, score };
  });
}

/** 3. Header row detection → skipRows + promoteHeader (threshold 0.6). */
export async function detectHeader(ctx: DetectContext): Promise<Proposal[]> {
  if (!ctx.columns.length) return [];
  const { rows, rowNumbers } = await fetchRows(ctx, 30);
  if (!rows.length) return [];
  const scores = scoreHeaderRows(rows);
  const found = scores.find((s) => s.score >= 0.6 && s.filled >= 0.5);
  if (!found) {
    return [{ kind: 'promoteHeader', params: { row: null, names: [] }, confidence: 1, threshold: 0 }];
  }
  const notes = rows
    .slice(0, found.index)
    .map((r) => r.filter((v): v is string => !isEmpty(v)).map((v) => v.trim()).join(' '))
    .filter(Boolean);
  const proposals: Proposal[] = [];
  if (found.index > 0) {
    proposals.push({ kind: 'skipRows', params: { count: found.index }, confidence: found.score, threshold: 0.6, notes });
  }
  proposals.push({
    kind: 'promoteHeader',
    params: { row: rowNumbers[found.index], names: rows[found.index].map((v) => (v ?? '').trim()), skipped: found.index },
    confidence: found.score,
    threshold: 0.6,
    notes: found.index > 0 ? undefined : notes,
  });
  return proposals;
}
