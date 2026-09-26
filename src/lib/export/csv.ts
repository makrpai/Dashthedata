import type { Locale } from '@/types/domain';

export interface CsvColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

/**
 * CSV with a UTF-8 BOM (13). Finnish locale uses ';' and a decimal comma, so Excel opens it
 * correctly; English uses ',' and a dot.
 */
export function rowsToCsv(columns: CsvColumn[], rows: Array<Record<string, unknown>>, locale: Locale): string {
  const sep = locale === 'fi' ? ';' : ',';
  const esc = (v: unknown, numeric?: boolean): string => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(v) : String(v);
    if (typeof v === 'number' && locale === 'fi') s = s.replace('.', ',');
    if (numeric && typeof v === 'number') return s;
    return /[";\n\r,]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(sep), ...rows.map((r) => columns.map((c) => esc(r[c.key], c.numeric)).join(sep))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Triggers a browser download. */
export function downloadBlob(data: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || 'export';
