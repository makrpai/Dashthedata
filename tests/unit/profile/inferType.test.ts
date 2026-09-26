import { describe, expect, it } from 'vitest';
import { inferColumnType } from '@/lib/profile/inferType';
import { inferRole } from '@/lib/profile/roles';

const infer = (values: string[], header = 'X', locale: 'fi' | 'en' = 'fi') => inferColumnType('c', values, header, locale);

describe('inferColumnType (8.1)', () => {
  it('integers and decimals', () => {
    expect(infer(['1', '2', '30']).cast).toMatchObject({ to: 'integer' });
    expect(infer(['1 234,50', '980,00', '12']).cast).toMatchObject({ to: 'decimal', numberFormat: { decimal: ',' } });
  });
  it('tolerates up to 5 % parse failures and reports examples', () => {
    const values = [...Array.from({ length: 40 }, (_, i) => String(i)), 'n/a', 'n/a'];
    const r = infer(values);
    expect(r.cast.to).toBe('integer');
    expect(r.failures).toEqual({ count: 2, examples: ['n/a'] });
  });
  it('falls back to text below 95 %', () => {
    expect(infer(['1', '2', 'x', 'y']).cast.to).toBe('text');
  });
  it('percent and currency', () => {
    expect(infer(['12 %', '5,5 %']).cast).toMatchObject({ to: 'decimal', percent: true });
    expect(infer(['12,00 €', '5 €']).cast).toMatchObject({ currency: 'EUR' });
  });
  it('long digit strings are text', () => {
    expect(infer(['1234567890123456', '1234567890123457']).cast.to).toBe('text');
  });
  it('years with a year header get a year grain', () => {
    expect(infer(['2023', '2024', '2025'], 'Vuosi').cast).toMatchObject({ to: 'integer', timeGrainHint: 'year' });
    expect(infer(['2023', '2024', '2025'], 'Määrä').cast.timeGrainHint).toBeUndefined();
  });
  it('booleans', () => {
    expect(infer(['kyllä', 'ei', 'Kyllä']).cast).toMatchObject({ to: 'boolean', booleanValues: { true: ['kyllä'], false: ['ei'] } });
    expect(infer(['yes', 'no']).cast.to).toBe('boolean');
    expect(infer(['1', '0', '1'], 'Aktiivinen').cast.to).toBe('boolean');
    expect(infer(['1', '0', '1'], 'Määrä').cast.to).toBe('integer');
    expect(infer(['k', 'k']).cast.to).not.toBe('boolean');
  });
  it('dates and datetimes', () => {
    expect(infer(['31.12.2025', '1.1.2025']).cast).toMatchObject({ to: 'date', dateFormats: ['dotted'] });
    expect(infer(['31.12.2025 14:30', '1.1.2025 8:00']).cast.to).toBe('datetime');
    expect(infer(['01/02/2025', '03/04/2025'], 'Pvm').warnings[0]?.code).toBe('ambiguous_format');
  });
  it('Excel serials with a date header become dates, otherwise numbers', () => {
    expect(infer(['45688', '45700'], 'Pvm').cast.to).toBe('date');
    expect(infer(['45688', '45700'], 'Summa').cast.to).toBe('integer');
  });
  it('flags mixed types', () => {
    expect(infer(['1', '2', 'x', 'y', 'z', '3']).warnings[0]?.code).toBe('mixed_types');
  });
});

describe('inferRole (8.5)', () => {
  const base = { stats: { count: 100, nulls: 0, distinct: 5 }, rowCount: 100 };
  it('time, id, measure, dimension, text', () => {
    expect(inferRole({ ...base, type: 'date', displayName: 'Pvm' })).toBe('time');
    expect(inferRole({ ...base, type: 'integer', displayName: 'Vuosi', timeGrainHint: 'year' })).toBe('time');
    expect(inferRole({ ...base, type: 'integer', displayName: 'asiakas_id', stats: { count: 100, nulls: 0, distinct: 100 } })).toBe('id');
    expect(inferRole({ ...base, type: 'text', displayName: 'Koodi', stats: { count: 100, nulls: 0, distinct: 99 }, avgLength: 6, lengthStddev: 0 })).toBe('id');
    expect(inferRole({ ...base, type: 'decimal', displayName: 'Myynti' })).toBe('measure');
    expect(inferRole({ ...base, type: 'integer', displayName: 'Määrä', stats: { count: 100, nulls: 0, distinct: 100 } })).toBe('measure');
    expect(inferRole({ ...base, type: 'text', displayName: 'Alue', avgLength: 7 })).toBe('dimension');
    expect(inferRole({ ...base, type: 'boolean', displayName: 'Aktiivinen' })).toBe('dimension');
    expect(inferRole({ ...base, type: 'text', displayName: 'Kommentti', stats: { count: 100, nulls: 0, distinct: 90 }, avgLength: 80, lengthStddev: 30 })).toBe('text');
  });
});

describe('foreign keys', () => {
  it('asiakas_id is an identifier even with repeated values', () => {
    expect(inferRole({ type: 'integer', displayName: 'asiakas_id', stats: { count: 300, nulls: 0, distinct: 60 }, rowCount: 300 })).toBe('id');
    expect(inferRole({ type: 'integer', displayName: 'Määrä', stats: { count: 300, nulls: 0, distinct: 60 }, rowCount: 300 })).toBe('measure');
  });
});
