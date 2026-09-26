import { describe, expect, it } from 'vitest';
import { baseName, detectFormat } from '@/lib/ingest/detect';
import { decodeText, encodeWindows1252, isUtf8 } from '@/lib/ingest/encoding';
import { delimiterScore, guessDelimiter } from '@/lib/ingest/csv';
import { excelSerialToIso, toCanonicalString } from '@/lib/ingest/values';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('detectFormat', () => {
  it('uses magic bytes before the extension', () => {
    expect(detectFormat('x.csv', bytes(0x50, 0x4b, 0x03, 0x04))).toBe('xlsx');
    expect(detectFormat('x.bin', bytes(0xd0, 0xcf, 0x11, 0xe0))).toBe('xls');
    expect(detectFormat('data', bytes(0x50, 0x41, 0x52, 0x31))).toBe('parquet');
  });
  it('falls back to the extension and content', () => {
    expect(detectFormat('a.TSV', bytes(0x61))).toBe('tsv');
    expect(detectFormat('a.json', bytes(0x61))).toBe('json');
    expect(detectFormat('noext', new TextEncoder().encode('  [{"a":1}]'))).toBe('json');
    expect(detectFormat('noext', bytes(0x61))).toBeNull();
    expect(baseName('myynti-2025.xlsx')).toBe('myynti-2025');
  });
});

describe('decodeText', () => {
  it('strips the UTF-8 BOM', () => {
    const r = decodeText(bytes(0xef, 0xbb, 0xbf, 0x61, 0xc3, 0xa4));
    expect(r).toEqual({ text: 'aä', encoding: 'utf-8' });
  });
  it('falls back to windows-1252 for Finnish Excel exports', () => {
    const r = decodeText(encodeWindows1252('Hämeenlinna;Jyväskylä;€'));
    expect(r.encoding).toBe('windows-1252');
    expect(r.text).toBe('Hämeenlinna;Jyväskylä;€');
  });
  it('detects UTF-8 even when a sample cuts a character', () => {
    const utf = new TextEncoder().encode('aaaaä');
    expect(isUtf8(utf.subarray(0, utf.length - 1))).toBe(true);
    expect(isUtf8(encodeWindows1252('ää ää'))).toBe(false);
  });
});

describe('guessDelimiter', () => {
  it('finds semicolons with decimal commas', () => {
    const text = 'Alue;Myynti;Kate\nHelsinki;1 234,50;12,5\nTampere;980,00;11,0\n';
    expect(guessDelimiter(text)).toBe(';');
  });
  it('finds commas with quoted fields', () => {
    const text = 'name,city,amount\n"Smith, John",Espoo,12\n"Doe; Jane",Turku,15\n';
    expect(guessDelimiter(text)).toBe(',');
  });
  it('finds tabs and pipes', () => {
    expect(guessDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t');
    expect(guessDelimiter('a|b|c\n1|2|3\n4|5|6\n')).toBe('|');
  });
  it('is not fooled by title rows', () => {
    const text = 'Raportti, 2025\n\nA;B;C;D\n1;2;3;4\n5;6;7;8\n9;10;11;12\n';
    expect(guessDelimiter(text)).toBe(';');
    expect(delimiterScore(text, ';')).toBeGreaterThan(delimiterScore(text, ','));
  });
});

describe('values', () => {
  it('converts Excel serials', () => {
    expect(excelSerialToIso(45688)).toBe('2025-01-31');
    expect(excelSerialToIso(45688.5)).toBe('2025-01-31T12:00:00');
    expect(excelSerialToIso(0, true)).toBe('1904-01-01');
  });
  it('canonicalises cell values', () => {
    expect(toCanonicalString(1234.5)).toBe('1234.5');
    expect(toCanonicalString(true)).toBe('true');
    expect(toCanonicalString('')).toBeNull();
    expect(toCanonicalString(new Date(2025, 0, 31))).toBe('2025-01-31');
    expect(toCanonicalString(Number.NaN)).toBeNull();
  });
});
