import { sqlLiteral } from '@/lib/duckdb/sql';

/**
 * Number formats (8.2). The same regular expressions drive the JS inference and the generated SQL,
 * so what the preview promises is exactly what castTypes produces.
 */
export interface NumberFormatSpec {
  /** 'either': both ',' and '.' act as decimal separators (Excel numbers mixed with Finnish text). */
  decimal: ',' | '.' | 'either';
  /** Thousands separator after whitespace has been removed: '.', ',' or none. Spaces are always dropped. */
  thousands: '.' | ',' | '';
  percent?: boolean;
  currency?: string;
}

const CURRENCY_PATTERN = '(€|\\$|£|kr|EUR|USD|GBP|SEK|NOK|DKK)';
const CURRENCY_RE = new RegExp(`^${CURRENCY_PATTERN}|${CURRENCY_PATTERN}$`, 'i');
const CURRENCY_CODES: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', kr: 'SEK' };

export interface Preprocessed {
  /** Digits, separators, sign and exponent only. */
  text: string;
  currency?: string;
  percent: boolean;
}

/** Removes spaces (incl. NBSP and narrow NBSP), currency, accounting parentheses and percent. */
export function preprocessNumber(raw: string): Preprocessed | null {
  let s = raw.trim().replace(/[\s  ]/g, '').replace(/−/g, '-');
  if (!s) return null;
  let currency: string | undefined;
  for (let i = 0; i < 2; i++) {
    const m = s.match(CURRENCY_RE);
    if (!m) break;
    const sym = m[0];
    currency = CURRENCY_CODES[sym] ?? CURRENCY_CODES[sym.toLowerCase()] ?? sym.toUpperCase();
    s = s.startsWith(sym) ? s.slice(sym.length) : s.slice(0, -sym.length);
  }
  let negative = false;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) {
    negative = true;
    s = paren[1];
  }
  // "-€12" and "€-12" both work: currency was stripped above.
  let percent = false;
  if (s.endsWith('%')) {
    percent = true;
    s = s.slice(0, -1);
  }
  if (!/^[-+]?[\d.,]*\d[\d.,]*(e[-+]?\d+)?$/i.test(s)) return null;
  if (negative) s = s.startsWith('-') ? s.slice(1) : `-${s}`;
  return { text: s, currency, percent };
}

const esc = (c: string) => (c === '.' ? '\\.' : c === 'either' ? '[.,]' : c);

/** Anchored pattern a preprocessed value must match for a given format (RE2 and JS compatible). */
export function validNumberPattern(spec: Pick<NumberFormatSpec, 'decimal' | 'thousands'>): string {
  const d = esc(spec.decimal);
  const int = spec.thousands ? `(?:\\d{1,3}(?:${esc(spec.thousands)}\\d{3})+|\\d+)` : '\\d+';
  return `^[-+]?(?:${int}(?:${d}\\d*)?|${d}\\d+)(?:[eE][-+]?\\d+)?$`;
}

/** Parses a single value with a known format. Returns null when it does not match. */
export function parseNumber(raw: string, spec: NumberFormatSpec): number | null {
  const pre = preprocessNumber(raw);
  if (!pre) return null;
  if (!new RegExp(validNumberPattern(spec)).test(pre.text)) return null;
  let s = pre.text;
  if (spec.thousands) s = s.split(spec.thousands).join('');
  if (spec.decimal !== '.') s = s.replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return pre.percent ? n / 100 : n;
}

export interface NumberDecision {
  spec: NumberFormatSpec;
  ambiguous: boolean;
}

/**
 * Decides the decimal separator for a column (8.2):
 * 1. both . and , present → the last one is the decimal separator
 * 2. only , → thousands if every value has exactly 3 digits after each comma and at least one value
 *    has several groups; decimal if some value has another digit count; otherwise ambiguous
 * 3. only . → the same
 * 4. ambiguous → data locale (auto → browser language), flagged with `ambiguous_format`.
 */
export function decideNumberFormat(
  values: string[],
  dataLocale: 'fi' | 'en',
  opts: { canonicalNumbers?: boolean } = {},
): NumberDecision {
  const pre = values.map(preprocessNumber).filter((p): p is Preprocessed => p !== null);
  const currencies = new Map<string, number>();
  let percentCount = 0;
  let lastComma = 0;
  let lastDot = 0;
  for (const p of pre) {
    if (p.currency) currencies.set(p.currency, (currencies.get(p.currency) ?? 0) + 1);
    if (p.percent) percentCount++;
    const c = p.text.lastIndexOf(',');
    const d = p.text.lastIndexOf('.');
    if (c >= 0 && d >= 0) {
      if (c > d) lastComma++;
      else lastDot++;
    }
  }
  const currency = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const percent = pre.length > 0 && percentCount / pre.length >= 0.5;
  const base = { percent: percent || undefined, currency };

  if (lastComma || lastDot) {
    return lastComma >= lastDot
      ? { spec: { decimal: ',', thousands: '.', ...base }, ambiguous: false }
      : { spec: { decimal: '.', thousands: ',', ...base }, ambiguous: false };
  }
  const judge = (sep: ',' | '.') => {
    const withSep = pre.filter((p) => p.text.includes(sep) && !/e/i.test(p.text));
    if (!withSep.length) return null;
    const allThree = withSep.every((p) => p.text.split(sep).slice(1).every((g) => /^\d{3}$/.test(g)));
    const multi = withSep.some((p) => p.text.split(sep).length > 2);
    if (allThree && multi) return 'thousands' as const;
    if (!allThree) return 'decimal' as const;
    return 'ambiguous' as const;
  };
  const comma = judge(',');
  const dot = judge('.');
  // A dollar or pound sign implies English grouping when the separator is ambiguous.
  const localeHint: 'fi' | 'en' = currency === 'USD' || currency === 'GBP' ? 'en' : dataLocale;
  const flagged = currency !== 'USD' && currency !== 'GBP';
  const spec = (decimal: NumberFormatSpec['decimal'], thousands: NumberFormatSpec['thousands'], ambiguous = false): NumberDecision => ({
    spec: { decimal, thousands, ...base },
    ambiguous,
  });
  if (comma && dot) {
    // Some values use commas and others dots, never both in one value.
    if (comma === 'decimal' && dot === 'decimal') return spec('either', '');
    if (comma === 'decimal') return spec(',', '.');
    if (dot === 'decimal') return spec('.', ',');
    return localeHint === 'fi' ? spec(',', '.', true) : spec('.', ',', true);
  }
  if (comma) {
    if (comma === 'decimal') return spec(',', '');
    if (comma === 'thousands') return spec('.', ',');
    return localeHint === 'fi' ? spec(',', '', flagged) : spec('.', ',', flagged);
  }
  if (dot) {
    if (dot === 'decimal') return spec('.', '');
    if (dot === 'thousands') return spec(',', '.');
    // Excel/JSON numbers are written with a dot decimal, so 1.125 stays 1.125.
    if (opts.canonicalNumbers) return spec('.', '');
    return localeHint === 'fi' ? spec(',', '.', true) : spec('.', '', true);
  }
  return { spec: { decimal: dataLocale === 'fi' ? ',' : '.', thousands: '', ...base }, ambiguous: false };
}

/** Parses a column's values with an automatically decided format (convenience for tests/UI). */
export function parseNumberAuto(value: string, dataLocale: 'fi' | 'en'): { value: number; currency?: string; percent: boolean } | null {
  const { spec } = decideNumberFormat([value], dataLocale);
  const pre = preprocessNumber(value);
  const n = parseNumber(value, spec);
  return n === null || !pre ? null : { value: n, currency: pre.currency, percent: pre.percent };
}

/** SQL expression converting a VARCHAR expression with the given format into DOUBLE (NULL on failure). */
export function numberCastSql(expr: string, spec: NumberFormatSpec): string {
  let x = `regexp_replace(trim(${expr}), '[\\s\\x{00A0}\\x{202F}]', '', 'g')`;
  x = `replace(${x}, '−', '-')`;
  x = `regexp_replace(regexp_replace(${x}, '^${CURRENCY_PATTERN}', '', 'i'), '${CURRENCY_PATTERN}$', '', 'i')`;
  const neg = `regexp_matches(${x}, '^\\(.*\\)$')`;
  x = `regexp_replace(${x}, '^\\((.*)\\)$', '\\1')`;
  const pct = `ends_with(${x}, '%')`;
  x = `regexp_replace(${x}, '%$', '')`;
  const valid = `regexp_matches(${x}, ${sqlLiteral(validNumberPattern(spec))})`;
  let cleaned = x;
  if (spec.thousands) cleaned = `replace(${cleaned}, ${sqlLiteral(spec.thousands)}, '')`;
  if (spec.decimal !== '.') cleaned = `replace(${cleaned}, ',', '.')`;
  return (
    `(CASE WHEN ${valid} THEN TRY_CAST(${cleaned} AS DOUBLE) ` +
    `* (CASE WHEN ${neg} THEN -1 ELSE 1 END) / (CASE WHEN ${pct} THEN 100 ELSE 1 END) END)`
  );
}
