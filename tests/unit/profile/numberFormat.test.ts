import { beforeAll, describe, expect, it } from 'vitest';
import { sqlLiteral } from '@/lib/duckdb/sql';
import { inferColumnType } from '@/lib/profile/inferType';
import { decideNumberFormat, numberCastSql, parseNumber, parseNumberAuto } from '@/lib/profile/numberFormat';
import { NodeRunner } from '../../helpers/nodeRunner';

// Plan table 8.2 – every row must pass.
const TABLE: Array<[string, number | null, { currency?: string; percent?: boolean }?]> = [
  ['1 234,56', 1234.56],
  ['1 234,56 €', 1234.56, { currency: 'EUR' }],
  ['1.234,56', 1234.56],
  ['1,234.56', 1234.56],
  ['-12,5', -12.5],
  ['−12,5', -12.5],
  ['(1 200)', -1200],
  ['12 %', 0.12, { percent: true }],
  ['12,5%', 0.125, { percent: true }],
  ['$1,200', 1200, { currency: 'USD' }],
  ['1e3', 1000],
  ['12,3,4', null],
];

describe('numberFormat (8.2 table)', () => {
  it.each(TABLE)('%s', (input, expected, extra) => {
    const r = parseNumberAuto(input, 'fi');
    if (expected === null) {
      expect(r).toBeNull();
      return;
    }
    expect(r?.value).toBeCloseTo(expected, 10);
    if (extra?.currency) expect(r?.currency).toBe(extra.currency);
    if (extra?.percent) expect(r?.percent).toBe(true);
  });

  it('00100 is text (leading zero)', () => {
    expect(inferColumnType('c', ['00100', '02100', '33100'], 'Postinumero', 'fi').cast.to).toBe('text');
  });
});

describe('decideNumberFormat', () => {
  it('thousands when several groups exist', () => {
    expect(decideNumberFormat(['1,234', '1,234,567'], 'fi')).toMatchObject({ spec: { decimal: '.', thousands: ',' }, ambiguous: false });
  });
  it('decimal comma when group lengths vary', () => {
    expect(decideNumberFormat(['1,5', '12,25', '1,234'], 'en').spec.decimal).toBe(',');
  });
  it('ambiguous values fall back to the data locale and are flagged', () => {
    expect(decideNumberFormat(['1,234', '5,678'], 'fi')).toMatchObject({ spec: { decimal: ',' }, ambiguous: true });
    expect(decideNumberFormat(['1,234', '5,678'], 'en')).toMatchObject({ spec: { decimal: '.', thousands: ',' }, ambiguous: true });
  });
  it('dot thousands (1.234.567)', () => {
    const d = decideNumberFormat(['1.234.567', '12.345'], 'en');
    expect(d.spec).toMatchObject({ decimal: ',', thousands: '.' });
    expect(parseNumber('1.234.567', d.spec)).toBe(1234567);
  });
});

describe('numberCastSql matches the JS parser', () => {
  let db: NodeRunner;
  beforeAll(async () => {
    db = await NodeRunner.create();
  });
  const cases: Array<[string, 'fi' | 'en']> = [
    ...TABLE.map(([v]) => [v, 'fi'] as [string, 'fi']),
    ['1,234.56', 'en'],
    ['£ 12.50', 'en'],
    ['12.5 kr', 'fi'],
    ['abc', 'fi'],
  ];
  it.each(cases)('%s (%s)', async (input, locale) => {
    const { spec } = decideNumberFormat([input], locale);
    const js = parseNumber(input, spec);
    const [row] = await db.query<{ v: number | null }>(`SELECT ${numberCastSql(sqlLiteral(input), spec)} AS v`);
    if (js === null) expect(row.v).toBeNull();
    else expect(row.v).toBeCloseTo(js, 10);
  });
});
