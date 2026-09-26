import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { ExcelError, listSheets, readWorkbook, sheetToMatrix, type XlsxLike } from '@/lib/ingest/excel';

const xlsx = XLSX as unknown as XlsxLike;

function workbook(): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Raportti 2025'],
    [],
    ['Alue', 'Summa', 'Pvm', 'Ok', 'Virhe'],
    ['Helsinki', 1234.5, 45688, true, 0],
    [null, 99, 45689.25, false, 0],
  ]);
  ws['C4'].z = 'd.m.yyyy';
  ws['C5'].z = 'd.m.yyyy h:mm';
  ws['E4'] = { t: 'e', v: 0x2a, w: '#N/A' };
  ws['!merges'] = [
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];
  const hidden = XLSX.utils.aoa_to_sheet([['x']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Myynti');
  XLSX.utils.book_append_sheet(wb, hidden, 'Piilo');
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

describe('excel', () => {
  it('lists sheets with hidden flags', () => {
    const wb = readWorkbook(xlsx, workbook());
    const sheets = listSheets(xlsx, wb);
    expect(sheets.map((s) => [s.name, s.hidden])).toEqual([
      ['Myynti', false],
      ['Piilo', true],
    ]);
    expect(sheets[0].rows).toBe(5);
  });

  it('converts cells canonically', () => {
    const wb = readWorkbook(xlsx, workbook());
    const { matrix, mergedColumns, errorCells } = sheetToMatrix(xlsx, wb, 'Myynti');
    expect(matrix[0]).toEqual(['Raportti 2025', null, null, null, null]);
    expect(matrix[1]).toEqual([null, null, null, null, null]);
    expect(matrix[3]).toEqual(['Helsinki', '1234.5', '2025-01-31', 'true', null]);
    expect(matrix[4]).toEqual([null, '99', '2025-02-01T06:00:00', 'false', '0']);
    expect(errorCells).toBe(1);
    // Only the vertical merge counts as a fill-down hint.
    expect(mergedColumns).toEqual([0]);
  });

  it('reports unreadable files', () => {
    expect(() => readWorkbook(xlsx, new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]))).toThrow(ExcelError);
  });
});
