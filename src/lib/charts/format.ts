import type { ColumnFormat, ColumnType, Locale, TimeGrain } from '@/types/domain';

const nf = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: Locale, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = nf.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    nf.set(key, f);
  }
  return f;
}

export interface NumberOptions {
  format?: ColumnFormat;
  /** Compact axis labels: fi "1,2 milj.", en "1.2M". */
  compact?: boolean;
  maximumFractionDigits?: number;
}

/** Decimals that keep small numbers readable without noise. */
function autoDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0 || abs >= 100) return 0;
  if (abs >= 1) return 2;
  return 3;
}

export function formatNumber(value: number | null | undefined, locale: Locale, opts: NumberOptions = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const unit = opts.format?.unit;
  const digits = opts.maximumFractionDigits ?? opts.format?.decimals ?? autoDigits(value);
  if (unit === 'percent') {
    return numberFormat(locale, { style: 'percent', maximumFractionDigits: opts.compact ? 0 : 1 }).format(value);
  }
  const base: Intl.NumberFormatOptions = opts.compact
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { maximumFractionDigits: digits, minimumFractionDigits: 0 };
  if (unit === 'currency' && opts.format?.currency) {
    try {
      return numberFormat(locale, { ...base, style: 'currency', currency: opts.format.currency }).format(value);
    } catch {
      /* unknown currency code */
    }
  }
  return numberFormat(locale, base).format(value);
}

export function formatPercent(value: number, locale: Locale, digits = 1): string {
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(value);
}

const MONTHS: Record<Locale, string[]> = {
  fi: ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Parses 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss' without time zone shifts. */
function parts(iso: string): { y: number; m: number; d: number; time?: string } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), time: m[4] };
}

/** Dates by grain (11.3): month fi "tammi 2025", en "Jan 2025"; quarter "Q1 2025". */
export function formatDate(iso: string | null | undefined, locale: Locale, grain?: TimeGrain | 'datetime'): string {
  if (!iso) return '';
  const p = parts(String(iso));
  if (!p) return String(iso);
  switch (grain) {
    case 'year':
      return String(p.y);
    case 'quarter':
      return `Q${Math.floor((p.m - 1) / 3) + 1} ${p.y}`;
    case 'month':
      return `${MONTHS[locale][p.m - 1]} ${p.y}`;
    case 'datetime':
      return locale === 'fi' ? `${p.d}.${p.m}.${p.y} ${p.time ?? '00:00'}` : `${p.m}/${p.d}/${p.y} ${p.time ?? '00:00'}`;
    default:
      return locale === 'fi' ? `${p.d}.${p.m}.${p.y}` : `${p.m}/${p.d}/${p.y}`;
  }
}

/** Formats a cell for tables and previews. */
export function formatCell(
  value: unknown,
  column: { type: ColumnType | 'varchar'; format?: ColumnFormat },
  locale: Locale,
  labels: { yes: string; no: string } = { yes: 'true', no: 'false' },
): string {
  if (value === null || value === undefined) return '';
  switch (column.type) {
    case 'integer':
    case 'decimal':
      return typeof value === 'number' ? formatNumber(value, locale, { format: column.format }) : String(value);
    case 'date': {
      const g = column.format?.timeGrainHint;
      return formatDate(String(value), locale, g === 'month' || g === 'quarter' || g === 'year' ? g : undefined);
    }
    case 'datetime':
      return formatDate(String(value), locale, 'datetime');
    case 'boolean':
      return value === true ? labels.yes : value === false ? labels.no : String(value);
    default:
      return String(value);
  }
}

/** Escapes text for HTML tooltips (ECharts formatters). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
