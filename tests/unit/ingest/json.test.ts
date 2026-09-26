import { describe, expect, it } from 'vitest';
import { jsonToMatrix } from '@/lib/ingest/json';

describe('jsonToMatrix', () => {
  it('uses a root array and flattens nested objects', () => {
    const r = jsonToMatrix([
      { id: 1, nimi: 'Kengät', kategoria: { nimi: 'Asusteet', id: 3 }, hinta: 49.9, tagit: ['uutuus', 'ale'] },
      { id: 2, nimi: 'Takki', kategoria: { nimi: 'Takit', id: 4 }, hinta: 129, varasto: true },
    ]);
    expect(r.matrix[0]).toEqual(['id', 'nimi', 'kategoria.nimi', 'kategoria.id', 'hinta', 'tagit', 'varasto']);
    expect(r.matrix[1]).toEqual(['1', 'Kengät', 'Asusteet', '3', '49.9', 'uutuus, ale', null]);
    expect(r.matrix[2][6]).toBe('true');
    expect(r.recordsPath).toBe('');
  });

  it('follows an explicit records path', () => {
    const r = jsonToMatrix({ data: { items: [{ a: 1 }, { a: 2 }] } }, 'data.items');
    expect(r.matrix).toEqual([['a'], ['1'], ['2']]);
    expect(r.recordsPath).toBe('data.items');
  });

  it('finds the largest object array in the tree', () => {
    const r = jsonToMatrix({ meta: { page: 1 }, data: [{ x: 1 }, { x: 2 }, { x: 3 }], links: [{ href: 'a' }] });
    expect(r.recordsPath).toBe('data');
    expect(r.matrix).toHaveLength(4);
  });

  it('reads columnar JSON (Open-Meteo style)', () => {
    const r = jsonToMatrix({
      latitude: 60.17,
      daily: { time: ['2025-01-01', '2025-01-02'], temperature_2m_max: [-1.5, 0.3] },
    });
    expect(r.matrix).toEqual([
      ['time', 'temperature_2m_max'],
      ['2025-01-01', '-1.5'],
      ['2025-01-02', '0.3'],
    ]);
    expect(r.recordsPath).toBe('daily');
  });

  it('stringifies arrays of objects with a warning', () => {
    const r = jsonToMatrix([{ id: 1, rows: [{ a: 1 }] }]);
    expect(r.matrix[1][1]).toBe('[{"a":1}]');
    expect(r.warnings[0].key).toBe('ingest.warning.nestedArrays');
  });

  it('flattens only to depth 3', () => {
    const r = jsonToMatrix([{ a: { b: { c: { d: 1 } } } }]);
    expect(r.matrix[0]).toEqual(['a.b.c']);
    expect(r.matrix[1][0]).toBe('{"d":1}');
  });
});
