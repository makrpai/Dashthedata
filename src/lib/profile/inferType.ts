import type { ColumnType, DataWarning, TimeGrain } from '@/types/domain';
import { DATE_HEADER_RE, decideDateFormats, parseDateValue, type DateFormatId } from './dateFormat';
import { decideNumberFormat, parseNumber, preprocessNumber, type NumberFormatSpec } from './numberFormat';

/** Result of type inference for one column; becomes one entry of the castTypes step (9.3). */
export interface CastColumn {
  columnId: string;
  to: ColumnType;
  numberFormat?: NumberFormatSpec;
  dateFormats?: DateFormatId[];
  /** Lower-cased values meaning true / false. */
  booleanValues?: { true: string[]; false: string[] };
  percent?: boolean;
  currency?: string;
  timeGrainHint?: TimeGrain;
}

export interface Inference {
  cast: CastColumn;
  /** Share of sample values that parsed with the chosen type. */
  ratio: number;
  failures: { count: number; examples: string[] };
  warnings: DataWarning[];
}

export const THRESHOLD = 0.95;
export const YEAR_HEADER_RE = /vuosi|year|\byr\b|\bv\./i;
const BOOL_HEADER_RE = /onko|aktiivinen|active|is_|has_|flag/i;

const TRUE_WORDS = ['kyllä', 'k', 'joo', 'true', 'yes', 'y', 'tosi'];
const FALSE_WORDS = ['ei', 'e', 'false', 'no', 'n', 'epätosi'];

function inferBoolean(values: string[], header: string): { ratio: number; map: { true: string[]; false: string[] } } | null {
  const norm = values.map((v) => v.trim().toLowerCase());
  const distinct = [...new Set(norm)];
  if (distinct.length === 0 || distinct.length > 2) return null;
  if (distinct.every((v) => v === '1' || v === '0')) {
    if (distinct.length !== 2 || !BOOL_HEADER_RE.test(header)) return null;
    return { ratio: 1, map: { true: ['1'], false: ['0'] } };
  }
  const t = distinct.filter((v) => TRUE_WORDS.includes(v));
  const f = distinct.filter((v) => FALSE_WORDS.includes(v));
  // Single letters are only booleans when they pair up (k/e, y/n).
  if (t.length + f.length !== distinct.length) return null;
  if (distinct.length === 2 && (t.length !== 1 || f.length !== 1)) return null;
  if (distinct.length === 1 && distinct[0].length === 1) return null;
  return { ratio: 1, map: { true: t, false: f } };
}

const examplesOf = (values: string[], ok: (v: string) => boolean) => {
  const bad = values.filter((v) => !ok(v));
  return { count: bad.length, examples: [...new Set(bad)].slice(0, 3) };
};

/**
 * Infers a column type from a sample of non-empty values (8.1). Order: boolean → integer →
 * decimal → date → datetime → text; the first with ≥ 95 % parse success wins.
 */
export function inferColumnType(
  columnId: string,
  rawValues: string[],
  header: string,
  dataLocale: 'fi' | 'en',
): Inference {
  const values = rawValues.map((v) => v.trim()).filter((v) => v !== '');
  const text = (warnings: DataWarning[] = []): Inference => ({
    cast: { columnId, to: 'text' },
    ratio: 1,
    failures: { count: 0, examples: [] },
    warnings,
  });
  if (values.length === 0) return text();

  const bool = inferBoolean(values, header);
  if (bool) {
    return { cast: { columnId, to: 'boolean', booleanValues: bool.map }, ratio: 1, failures: { count: 0, examples: [] }, warnings: [] };
  }

  // Special rules before numbers: identifiers with leading zeros and very long digit strings.
  const digitsOnly = values.filter((v) => /^\d+$/.test(v));
  const leadingZero = digitsOnly.filter((v) => v.length > 1 && v.startsWith('0'));
  if (leadingZero.length / values.length > 0.05) return text();
  if (digitsOnly.some((v) => v.length > 15)) return text();

  const decision = decideNumberFormat(values, dataLocale);
  const parsed = values.map((v) => parseNumber(v, decision.spec));
  const okCount = parsed.filter((n) => n !== null).length;
  const numberRatio = okCount / values.length;
  const isDateHeader = DATE_HEADER_RE.test(header);

  if (numberRatio >= THRESHOLD) {
    const nums = parsed.filter((n): n is number => n !== null);
    const hasDecimals = nums.some((n) => !Number.isInteger(n));
    const anyPercent = values.some((v) => preprocessNumber(v)?.percent);
    const allSerial = nums.every((n) => n >= 20000 && n <= 80000);
    if (isDateHeader && allSerial) {
      // Excel serial dates, handled by the date branch below.
    } else {
      const warnings: DataWarning[] = [];
      if (decision.ambiguous) warnings.push({ code: 'ambiguous_format', params: { kind: 'number', example: values[0] } });
      const failures = examplesOf(values, (v) => parseNumber(v, decision.spec) !== null);
      if (!hasDecimals && !anyPercent && nums.every((n) => Math.abs(n) < 2 ** 53)) {
        const years = nums.every((n) => n >= 1900 && n <= 2100);
        return {
          cast: {
            columnId,
            to: 'integer',
            numberFormat: decision.spec,
            currency: decision.spec.currency,
            timeGrainHint: years && YEAR_HEADER_RE.test(header) ? 'year' : undefined,
          },
          ratio: numberRatio,
          failures,
          warnings,
        };
      }
      return {
        cast: {
          columnId,
          to: 'decimal',
          numberFormat: decision.spec,
          percent: anyPercent || undefined,
          currency: decision.spec.currency,
        },
        ratio: numberRatio,
        failures,
        warnings,
      };
    }
  }

  const dates = decideDateFormats(values, header, dataLocale);
  if (dates && dates.ratio >= THRESHOLD) {
    const to: ColumnType = dates.hasTimeRatio > 0.05 ? 'datetime' : 'date';
    const warnings: DataWarning[] = [];
    if (dates.ambiguous) warnings.push({ code: 'ambiguous_format', params: { kind: 'date', example: values[0] } });
    return {
      cast: { columnId, to, dateFormats: dates.formats, timeGrainHint: dates.grain },
      ratio: dates.ratio,
      failures: examplesOf(values, (v) => parseDateValue(v, dates.formats) !== null),
      warnings,
    };
  }
  const mixed = numberRatio > 0.3 && numberRatio < THRESHOLD;
  return text(mixed ? [{ code: 'mixed_types', params: { ratio: Math.round(numberRatio * 100) } }] : []);
}
