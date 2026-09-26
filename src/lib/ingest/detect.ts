import type { FileFormat } from '@/types/domain';

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

/** Detects the format from magic bytes first, then the file extension (7.1). */
export function detectFormat(fileName: string, head: Uint8Array): FileFormat | null {
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return 'xlsx';
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0])) return 'xls';
  if (startsWith(head, [0x50, 0x41, 0x52, 0x31])) return 'parquet'; // PAR1
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'xlsx':
    case 'xlsm':
      return 'xlsx';
    case 'xls':
      return 'xls';
    case 'parquet':
      return 'parquet';
    case 'json':
    case 'geojson':
      return 'json';
    case 'tsv':
    case 'tab':
      return 'tsv';
    case 'csv':
    case 'txt':
      return 'csv';
    default: {
      // Text that starts with { or [ is JSON; other text is treated as CSV.
      const first = head.find((b) => b !== 0x20 && b !== 0x0a && b !== 0x0d && b !== 0x09 && b !== 0xef && b !== 0xbb && b !== 0xbf);
      if (first === 0x7b || first === 0x5b) return 'json';
      return null;
    }
  }
}

/** Display name without extension, e.g. "myynti-2025". */
export function baseName(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i > 0 ? fileName.slice(0, i) : fileName;
}
