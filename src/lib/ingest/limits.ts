export const MB = 1024 * 1024;

/** File size limits (7.1). There is no hard row limit; a warning is shown above ROW_WARNING. */
export const LIMITS = {
  excel: 50 * MB,
  excelWarn: 15 * MB,
  text: 500 * MB,
  parquet: 1024 * MB,
  /** UTF-8 CSVs above this are registered as file handles instead of copied as text. */
  largeText: 100 * MB,
  rowWarning: 2_000_000,
} as const;

export function formatBytes(bytes: number, locale: string): string {
  const units = ['B', 'kB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}
