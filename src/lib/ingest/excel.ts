import type { CellObject, WorkBook, WorkSheet } from 'xlsx';
import { excelSerialToIso, rectangular, toCanonicalString } from './values';

/** The subset of the SheetJS API used here (injected so Node tests can call it directly). */
export interface XlsxLike {
  read(data: ArrayBuffer | Uint8Array, opts: Record<string, unknown>): WorkBook;
  utils: { decode_range(ref: string): { s: { r: number; c: number }; e: { r: number; c: number } } };
  SSF: { is_date(fmt: string | number): boolean };
}

export interface SheetInfo {
  name: string;
  rows: number;
  cols: number;
  hidden: boolean;
  empty: boolean;
}

export interface SheetMatrix {
  matrix: Array<Array<string | null>>;
  /** Column indexes that contain vertically merged cells (fill-down hints, 9.4.3). */
  mergedColumns: number[];
  /** Error cells (#N/A, #DIV/0!) converted to NULL. */
  errorCells: number;
}

export class ExcelError extends Error {
  constructor(readonly code: 'passwordProtected' | 'unreadable') {
    super(code);
  }
}

export function readWorkbook(xlsx: XlsxLike, data: ArrayBuffer | Uint8Array): WorkBook {
  try {
    return xlsx.read(data, { type: 'array', dense: true, cellNF: true, cellDates: false, cellFormula: false, cellHTML: false });
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('password') || message.includes('encrypt')) throw new ExcelError('passwordProtected');
    throw new ExcelError('unreadable');
  }
}

export function listSheets(xlsx: XlsxLike, wb: WorkBook): SheetInfo[] {
  return wb.SheetNames.map((name, i) => {
    const ws = wb.Sheets[name];
    const ref = ws?.['!ref'];
    const hidden = Boolean(wb.Workbook?.Sheets?.[i]?.Hidden);
    if (!ref) return { name, rows: 0, cols: 0, hidden, empty: true };
    const range = xlsx.utils.decode_range(ref);
    const rows = range.e.r - range.s.r + 1;
    const cols = range.e.c - range.s.c + 1;
    return { name, rows, cols, hidden, empty: rows <= 1 && cols <= 1 && !cellAt(ws, range.s.r, range.s.c)?.v };
  });
}

type DenseSheet = WorkSheet & { '!data'?: CellObject[][] };

function cellAt(ws: WorkSheet, r: number, c: number): CellObject | undefined {
  const dense = (ws as DenseSheet)['!data'];
  if (dense) return dense[r]?.[c];
  if (Array.isArray(ws)) return (ws as unknown as CellObject[][])[r]?.[c];
  const indexed = (ws as unknown as Record<number, CellObject[]>)[r];
  if (Array.isArray(indexed)) return indexed[c];
  return (ws as unknown as Record<string, CellObject>)[encodeCell(r, c)];
}

function encodeCell(r: number, c: number): string {
  let col = '';
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    col = String.fromCharCode(65 + m) + col;
    n = Math.floor((n - 1) / 26);
  }
  return `${col}${r + 1}`;
}

/**
 * Converts a sheet to a canonical string matrix (7.2): numbers with a dot, dates as ISO,
 * booleans true/false, formulas as their cached value, error cells as NULL.
 * Merged cells are NOT filled here; fillDown does that visibly in the log.
 */
export function sheetToMatrix(xlsx: XlsxLike, wb: WorkBook, sheetName: string): SheetMatrix {
  const ws = wb.Sheets[sheetName];
  if (!ws?.['!ref']) return { matrix: [], mergedColumns: [], errorCells: 0 };
  const range = xlsx.utils.decode_range(ws['!ref']);
  const date1904 = Boolean(wb.Workbook?.WBProps?.date1904);
  let errorCells = 0;
  const rows: Array<Array<string | null>> = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Array<string | null> = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = cellAt(ws, r, c);
      if (!cell || cell.t === 'z') {
        row.push(null);
      } else if (cell.t === 'e') {
        errorCells++;
        row.push(null);
      } else if (cell.t === 'n') {
        const fmt = cell.z;
        const isDate = fmt !== undefined && fmt !== 'General' && xlsx.SSF.is_date(fmt);
        row.push(isDate && typeof cell.v === 'number' ? excelSerialToIso(cell.v, date1904) : toCanonicalString(cell.v));
      } else if (cell.t === 'd') {
        row.push(toCanonicalString(cell.v));
      } else {
        row.push(toCanonicalString(cell.v));
      }
    }
    rows.push(row);
  }
  // Drop trailing rows that are completely empty.
  while (rows.length > 0 && rows[rows.length - 1].every((v) => v === null)) rows.pop();
  const merged = new Set<number>();
  for (const m of ws['!merges'] ?? []) {
    if (m.e.r > m.s.r) for (let c = m.s.c; c <= m.e.c; c++) merged.add(c - range.s.c);
  }
  return { matrix: rectangular(rows).rows, mergedColumns: [...merged].sort((a, b) => a - b), errorCells };
}
