import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from '@/lib/connectors/ssrf';
import { assertSelectOnly } from '@/lib/connectors/sqlGuard';
import { normalizeHttpSource, rowsFromJson } from '@/lib/connectors/http';

describe('connectors', () => {
  it('blocks private addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.1.2.3')).toBe(true);
    expect(isPrivateAddress('192.168.0.4')).toBe(true);
    expect(isPrivateAddress('169.254.1.1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('allows a single select and rejects writes', () => {
    expect(assertSelectOnly('SELECT 1')).toBe('SELECT 1');
    expect(() => assertSelectOnly('SELECT 1; DROP TABLE t')).toThrow(/one SQL/);
    expect(() => assertSelectOnly('DELETE FROM t')).toThrow(/SELECT/);
    expect(() => assertSelectOnly('SELECT * FROM t -- comment')).toThrow(/comment/);
  });

  it('rewrites Google Sheets links and reads record lists', () => {
    const sheets = normalizeHttpSource('https://docs.google.com/spreadsheets/d/abc123/edit#gid=0');
    expect(sheets.googleSheets).toBe(true);
    expect(sheets.url).toContain('/export?format=csv');
    expect(rowsFromJson([{ city: 'Turku', n: 1 }])).toEqual({ headers: ['city', 'n'], rows: [['Turku', '1']] });
  });
});
