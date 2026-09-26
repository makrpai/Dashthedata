import { describe, expect, it } from 'vitest';
import { scoreHeaderRows } from '@/lib/etl/detect/header';

describe('header detection (9.4.1)', () => {
  it('finds the header below title rows', () => {
    const rows = [
      ['Myyntiraportti 2025', null, null, null],
      ['Tulostettu 3.1.2026', null, null, null],
      ['Alue', 'Tuote', 'tammi', 'helmi'],
      ['Helsinki', 'Kengät', '120', '130'],
      [null, 'Takit', '80', '90'],
    ];
    const scores = scoreHeaderRows(rows);
    const found = scores.find((s) => s.score >= 0.6 && s.filled >= 0.5);
    expect(found?.index).toBe(2);
  });
  it('treats the first row as the header in a normal table', () => {
    const rows = [
      ['name', 'amount', 'date'],
      ['a', '1', '2025-01-01'],
      ['b', '2', '2025-01-02'],
    ];
    expect(scoreHeaderRows(rows)[0].score).toBeGreaterThanOrEqual(0.6);
  });
  it('finds no header in numbers-only data', () => {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ];
    expect(scoreHeaderRows(rows).every((s) => s.score < 0.6)).toBe(true);
  });
});
