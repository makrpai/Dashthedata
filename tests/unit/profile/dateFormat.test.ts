import { beforeAll, describe, expect, it } from 'vitest';
import { sqlLiteral } from '@/lib/duckdb/sql';
import { dateCastSql, decideDateFormats, parseDateValue, parseDateWith, type DateFormatId } from '@/lib/profile/dateFormat';
import { NodeRunner } from '../../helpers/nodeRunner';

const CASES: Array<[string, DateFormatId, string | null]> = [
  ['2025-12-31', 'iso', '2025-12-31'],
  ['2025-1-5', 'iso', '2025-01-05'],
  ['2025-12-31T14:30', 'iso', '2025-12-31T14:30:00'],
  ['2025-12-31T14:30:15.123Z', 'iso', '2025-12-31T14:30:15'],
  ['2025-12-31 08:00:00+02:00', 'iso', '2025-12-31T08:00:00'],
  ['2025-03', 'isoMonth', '2025-03-01'],
  ['31.12.2025', 'dotted', '2025-12-31'],
  ['1.2.2025', 'dotted', '2025-02-01'],
  ['1.2.25', 'dotted', '2025-02-01'],
  ['1.2.75', 'dotted', '1975-02-01'],
  ['31.12.2025 klo 14.30', 'dotted', '2025-12-31T14:30:00'],
  ['31.12.2025 14:30', 'dotted', '2025-12-31T14:30:00'],
  ['31/12/2025', 'dmy', '2025-12-31'],
  ['12/31/2025', 'mdy', '2025-12-31'],
  ['tammikuu 2025', 'monthName:fi', '2025-01-01'],
  ['tammi 2025', 'monthName:fi', '2025-01-01'],
  ['Mar 2025', 'monthName:fi', '2025-11-01'],
  ['Mar 2025', 'monthName:en', '2025-03-01'],
  ['January 2025', 'monthName:en', '2025-01-01'],
  ['Jan 2025', 'monthName:en', '2025-01-01'],
  ['2025 Q1', 'quarterYQ', '2025-01-01'],
  ['Q3/2025', 'quarterQY', '2025-07-01'],
  ['Q4 2025', 'quarterQY', '2025-10-01'],
  ['1. neljännes 2025', 'quarterFi', '2025-01-01'],
  ['2. nelj. 2025', 'quarterFi', '2025-04-01'],
  ['45688', 'excelSerial', '2025-01-31'],
  ['45688.5', 'excelSerial', '2025-01-31T12:00:00'],
  ['31.2.2025', 'dotted', null],
  ['2025-13-01', 'iso', null],
  ['12345', 'excelSerial', null],
];

describe('dateFormat (8.3)', () => {
  it.each(CASES)('%s as %s', (input, id, expected) => {
    expect(parseDateWith(input, id)?.iso ?? null).toBe(expected);
  });

  it('decides D/M when a first part is > 12', () => {
    const d = decideDateFormats(['13/02/2025', '01/02/2025'], 'Pvm', 'en');
    expect(d?.formats).toContain('dmy');
    expect(d?.ambiguous).toBe(false);
  });
  it('decides M/D when a second part is > 12', () => {
    expect(decideDateFormats(['12/31/2025', '1/2/2025'], 'Date', 'fi')?.formats).toContain('mdy');
  });
  it('ambiguous slash dates use the data locale and are flagged', () => {
    const fi = decideDateFormats(['01/02/2025', '03/04/2025'], 'Pvm', 'fi');
    expect(fi).toMatchObject({ formats: ['dmy'], ambiguous: true });
    expect(parseDateValue('01/02/2025', fi!.formats)?.iso).toBe('2025-02-01');
    const en = decideDateFormats(['01/02/2025', '03/04/2025'], 'Date', 'en');
    expect(parseDateValue('01/02/2025', en!.formats)?.iso).toBe('2025-01-02');
  });
  it('Excel serials only with a date-like header', () => {
    expect(decideDateFormats(['45688', '45700'], 'Summa', 'fi')).toBeNull();
    expect(decideDateFormats(['45688', '45700'], 'Asiakkaaksi pvm', 'fi')?.formats).toEqual(['excelSerial']);
  });
  it('mixed formats are combined', () => {
    const d = decideDateFormats(['31.12.2025', '45688', '1.1.2024'], 'Päivämäärä', 'fi');
    expect(d?.formats).toEqual(['dotted', 'excelSerial']);
    expect(d?.ratio).toBe(1);
  });
  it('month names detect Finnish vocabulary and a month grain', () => {
    const d = decideDateFormats(['tammi 2025', 'maalis 2025', 'mar 2025'], 'Kuukausi', 'en');
    expect(d?.formats).toEqual(['monthName:fi']);
    expect(d?.grain).toBe('month');
  });
});

describe('dateCastSql matches the JS parser', () => {
  let db: NodeRunner;
  beforeAll(async () => {
    db = await NodeRunner.create();
  });
  it.each(CASES)('%s as %s', async (input, id, expected) => {
    const [row] = await db.query<{ v: string | null }>(`SELECT ${dateCastSql(sqlLiteral(input), [id], 'datetime')} AS v`);
    const want = expected === null ? null : expected.includes('T') ? expected : `${expected}T00:00:00`;
    expect(row.v).toBe(want);
  });
  it('casts to DATE and coalesces formats', async () => {
    const sql = dateCastSql('x', ['dotted', 'iso'], 'date');
    const rows = await db.query(`SELECT ${sql} AS v FROM (VALUES ('1.2.2025'), ('2025-03-04'), ('nope')) t(x)`);
    expect(rows.map((r) => r.v)).toEqual(['2025-02-01', '2025-03-04', null]);
  });
});
