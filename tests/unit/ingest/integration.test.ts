import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { beforeAll, describe, expect, it } from 'vitest';
import { listSheets, readWorkbook, sheetToMatrix, type XlsxLike } from '@/lib/ingest/excel';
import { ingestDelimitedBytes, ingestJsonText, ingestParquetBytes } from '@/lib/ingest';
import { ingestMatrix } from '@/lib/ingest/matrix';
import { NodeRunner } from '../../helpers/nodeRunner';

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, '../../fixtures', name)));
const xlsx = XLSX as unknown as XlsxLike;

let db: NodeRunner;
beforeAll(async () => {
  db = await NodeRunner.create();
});

describe('ingest into DuckDB (integration)', () => {
  it('loads a windows-1252 semicolon CSV with ääkköset', async () => {
    const r = await ingestDelimitedBytes(db, { table: 'raw_w', bytes: fixture('win1252-semicolon.csv'), format: 'csv' });
    expect(r).toMatchObject({ rowCount: 4, columnCount: 4, encoding: 'windows-1252', delimiter: ';' });
    const rows = await db.query('SELECT * FROM raw_w ORDER BY __row');
    expect(rows[0]).toEqual({ __row: 1, c0: 'Kaupunki', c1: 'Myyjä', c2: 'Myynti €', c3: 'Päivä' });
    expect(rows[1]).toEqual({ __row: 2, c0: 'Hämeenlinna', c1: 'Äijälä', c2: '1 234,56', c3: '31.12.2025' });
  });

  it('keeps title rows above the header as raw rows', async () => {
    const r = await ingestDelimitedBytes(db, { table: 'raw_h', bytes: fixture('header-offset.csv'), format: 'csv' });
    expect(r.delimiter).toBe(';');
    expect(r.columnCount).toBe(3);
    const rows = await db.query('SELECT c0, c1, c2 FROM raw_h ORDER BY __row');
    expect(rows[0]).toEqual({ c0: 'Kuukausiraportti', c1: null, c2: null });
    // DuckDB skips completely blank lines; dropEmptyRows would remove them anyway.
    expect(rows[2]).toEqual({ c0: 'Tuote', c1: 'Kpl', c2: 'Summa' });
  });

  it('keeps leading zeros (everything is text)', async () => {
    await ingestDelimitedBytes(db, { table: 'raw_z', bytes: fixture('leading-zeros.csv'), format: 'csv' });
    const rows = await db.query('SELECT c0, c1 FROM raw_z WHERE __row = 2');
    expect(rows[0]).toEqual({ c0: '000123', c1: '00100' });
  });

  it('loads the large sample CSV', async () => {
    const bytes = new Uint8Array(readFileSync(join(__dirname, '../../../public/samples/sales-orders.csv')));
    const r = await ingestDelimitedBytes(db, { table: 'raw_so', bytes, format: 'csv' });
    expect(r).toMatchObject({ rowCount: 5001, columnCount: 10, delimiter: ',' });
  });

  it('loads Excel sheets through the matrix path', async () => {
    const wb = readWorkbook(xlsx, fixture('fi-sales-messy.xlsx'));
    const sheets = listSheets(xlsx, wb);
    expect(sheets.map((s) => s.name)).toEqual(['Myynti 2025', 'Asiakkaat']);
    const sales = sheetToMatrix(xlsx, wb, 'Myynti 2025');
    expect(sales.mergedColumns).toContain(0);
    const r = await ingestMatrix(db, 'raw_x', sales.matrix);
    expect(r.columnCount).toBe(16);
    expect(r.rowCount).toBe(29); // title, printed, blank, header, 24 rows, total
    const [header] = await db.query('SELECT c0, c1, c2, c13, c14, c15 FROM raw_x WHERE __row = 4');
    expect(header).toEqual({ c0: 'Alue', c1: 'Tuoteryhmä', c2: 'tammi', c13: 'joulu', c14: null, c15: 'Yhteensä' });

    const customers = sheetToMatrix(xlsx, wb, 'Asiakkaat');
    await ingestMatrix(db, 'raw_c', customers.matrix);
    const dates = await db.query<{ c3: string }>("SELECT c3 FROM raw_c WHERE __row > 1 AND c3 LIKE '____-__-__'");
    expect(dates.length).toBeGreaterThan(50); // Excel date cells became ISO
    const [first] = await db.query('SELECT c0 FROM raw_c WHERE __row = 2');
    expect(first.c0).toMatch(/^0\d{5}$/);
  });

  it('loads nested and columnar JSON', async () => {
    const nested = await ingestJsonText(db, { table: 'raw_j', text: readFileSync(join(__dirname, '../../fixtures/nested.json'), 'utf8') });
    expect(nested.rowCount).toBe(13);
    const [head] = await db.query('SELECT * EXCLUDE (__row) FROM raw_j WHERE __row = 1');
    expect(Object.values(head)).toContain('kategoria.nimi');
    const col = await ingestJsonText(db, { table: 'raw_cj', text: readFileSync(join(__dirname, '../../fixtures/columnar.json'), 'utf8') });
    expect(col).toMatchObject({ rowCount: 15, columnCount: 3, recordsPath: 'daily' });
  });

  it('loads Parquet as a typed table', async () => {
    await db.exec(
      "CREATE TABLE src AS SELECT i AS id, 'x' || i AS name, i * 1.5 AS amount, DATE '2025-01-01' + CAST(i AS INTEGER) AS day FROM range(1, 11) t(i)",
    );
    const bytes = await db.copyToBuffer('SELECT * FROM src', 'parquet');
    const r = await ingestParquetBytes(db, { table: 'raw_p', bytes });
    expect(r.typed?.columnNames).toEqual(['id', 'name', 'amount', 'day']);
    expect(r.typed?.columnTypes).toEqual(['integer', 'text', 'decimal', 'date']);
    const [row] = await db.query('SELECT * FROM raw_p WHERE __row = 1');
    expect(row).toEqual({ __row: 1, c0: 1, c1: 'x1', c2: 1.5, c3: '2025-01-02' });
  });
});
