import { describe, expect, it } from 'vitest';
import { caseVariantMapping, typoMapping } from '@/lib/etl/detect/categories';

describe('category standardisation (9.4.5)', () => {
  it('maps case and space variants to the most common spelling', () => {
    expect(
      caseVariantMapping([
        { value: 'Turku', count: 3 },
        { value: 'turku', count: 1 },
        { value: 'Tampere', count: 4 },
      ]),
    ).toEqual({ turku: 'Turku' });
  });
  it('ties prefer the capitalised variant', () => {
    expect(caseVariantMapping([{ value: 'oulu', count: 2 }, { value: 'Oulu', count: 2 }])).toEqual({ oulu: 'Oulu' });
  });
  it('leaves distinct values alone', () => {
    expect(caseVariantMapping([{ value: 'Espoo', count: 2 }, { value: 'Vantaa', count: 2 }])).toEqual({});
  });
  it('suggests typo fixes only for much rarer values of length ≥ 5', () => {
    expect(typoMapping([{ value: 'Tampere', count: 120 }, { value: 'Tampre', count: 2 }])).toEqual({ Tampre: 'Tampere' });
    expect(typoMapping([{ value: 'Tampere', count: 12 }, { value: 'Tampre', count: 2 }])).toEqual({});
    expect(typoMapping([{ value: 'Pori', count: 120 }, { value: 'Pöri', count: 1 }])).toEqual({});
  });
});
