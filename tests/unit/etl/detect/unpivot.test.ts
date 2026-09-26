import { describe, expect, it } from 'vitest';
import { parsePeriodHeader, valueNameFrom } from '@/lib/etl/detect/unpivot';

describe('unpivot period headers (9.4.4)', () => {
  it.each([
    ['tammi', { type: 'month', month: 1 }],
    ['Tammikuu', { type: 'month', month: 1 }],
    ['tam', { type: 'month', month: 1 }],
    ['joulu', { type: 'month', month: 12 }],
    ['Jan', { type: 'month', month: 1 }],
    ['December', { type: 'month', month: 12 }],
    ['tammi 2025', { type: 'month', month: 1, year: 2025 }],
    ['1/2025', { type: 'month', month: 1, year: 2025 }],
    ['2025-03', { type: 'month', month: 3, year: 2025 }],
    ['Q1', { type: 'quarter', quarter: 1 }],
    ['Q2 2025', { type: 'quarter', quarter: 2, year: 2025 }],
    ['1. nelj.', { type: 'quarter', quarter: 1 }],
    ['3. neljännes', { type: 'quarter', quarter: 3 }],
    ['2024', { type: 'year', year: 2024 }],
    ['31.12.2025', { type: 'date', iso: '2025-12-31' }],
  ])('%s', (header, expected) => {
    expect(parsePeriodHeader(header, 'fi')).toMatchObject(expected);
  });
  it.each(['Alue', 'Tuote', 'Yhteensä', 'Summa', '12345'])('not a period: %s', (h) => {
    expect(parsePeriodHeader(h, 'fi')).toBeNull();
  });
  it('value names', () => {
    expect(valueNameFrom('Myynti 2025')).toEqual({ fi: 'Myynti', en: 'Myynti' });
    expect(valueNameFrom('Kvartaalit')).toEqual({ fi: 'Arvo', en: 'Value' });
  });
});
