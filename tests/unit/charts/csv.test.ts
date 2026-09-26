import { describe, expect, it } from 'vitest';
import { rowsToCsv } from '@/lib/export/csv';

describe('rowsToCsv (13)', () => {
  const cols = [
    { key: 'a', label: 'Alue' },
    { key: 'v', label: 'Myynti', numeric: true },
  ];
  const rows = [
    { a: 'Helsinki', v: 1234.5 },
    { a: 'Oulu; "pohjoinen"', v: null },
  ];
  it('Finnish: BOM, semicolons, decimal comma', () => {
    expect(rowsToCsv(cols, rows, 'fi')).toBe('﻿Alue;Myynti\r\nHelsinki;1234,5\r\n"Oulu; ""pohjoinen""";\r\n');
  });
  it('English: commas and dots', () => {
    expect(rowsToCsv(cols, rows, 'en')).toBe('﻿Alue,Myynti\r\nHelsinki,1234.5\r\n"Oulu; ""pohjoinen""",\r\n');
  });
});
