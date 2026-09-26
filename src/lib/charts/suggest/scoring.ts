import type { Agg, ColumnProfile, TimeGrain } from '@/types/domain';

export const KEYWORD_RE =
  /myynti|liikevaihto|tulot|revenue|sales|amount|summa|arvo|value|kate|margin|voitto|profit|määrä|maara|quantity|qty|kpl|kustannus|cost|hinta|price|tunnit|hours/i;
const AVG_RE = /hinta|price|keskiarvo|avg|average|rate|%|pct|percent|prosentti|osuus|share|pisteet|score|arvosana|lämpötila|temp/i;

export const keywordBoost = (c: ColumnProfile) => (KEYWORD_RE.test(c.displayName) ? 1 : 0);

/** Measure importance (12.1). */
export function importance(c: ColumnProfile): number {
  const nullRatio = c.stats.count ? c.stats.nulls / c.stats.count : 1;
  const variance = (c.stats.stddev ?? 0) > 0 || (c.stats.min !== c.stats.max && c.stats.min !== undefined) ? 1 : 0;
  return 0.5 * (1 - nullRatio) + 0.3 * keywordBoost(c) + 0.2 * variance;
}

/** Default aggregation: avg for prices, rates, percentages and scores; otherwise sum (12.1). */
export function defaultAgg(c: ColumnProfile): Agg {
  return AVG_RE.test(c.displayName) || c.format?.unit === 'percent' ? 'avg' : 'sum';
}

/** Time grain giving roughly 12–60 points (12.2). The column's grain hint wins. */
export function chooseGrain(c: ColumnProfile): TimeGrain {
  const hint = c.format?.timeGrainHint;
  if (hint) return hint;
  const min = typeof c.stats.min === 'string' ? Date.parse(c.stats.min.slice(0, 10)) : NaN;
  const max = typeof c.stats.max === 'string' ? Date.parse(c.stats.max.slice(0, 10)) : NaN;
  if (Number.isNaN(min) || Number.isNaN(max)) return 'month';
  const days = (max - min) / 86400000;
  if (days < 90) return 'day';
  if (days < 365) return 'week';
  if (days < 5 * 365) return 'month';
  if (days < 15 * 365) return 'quarter';
  return 'year';
}

export const nullShare = (cols: Array<ColumnProfile | undefined>) => {
  const used = cols.filter((c): c is ColumnProfile => Boolean(c));
  if (!used.length) return 0;
  return Math.max(...used.map((c) => (c.stats.count ? c.stats.nulls / c.stats.count : 0)));
};

/** finalScore = (base + signals) × semanticBoost × quality (12.3). */
export function finalScore(base: number, signals: number, measure: ColumnProfile | undefined, used: Array<ColumnProfile | undefined>): number {
  const semantic = 1 + 0.2 * (measure ? keywordBoost(measure) : 0);
  const quality = 1 - nullShare(used);
  return Math.round((base + signals) * semantic * quality * 1000) / 1000;
}
