import { describe, expect, it } from 'vitest';
import { createT, detectLocale, dictionaries, flattenDictionary, translate } from '@/lib/i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n dictionaries', () => {
  const en = flattenDictionary(dictionaries.en);
  const fi = flattenDictionary(dictionaries.fi);

  it('fi and en have exactly the same keys', () => {
    expect([...fi.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('every translation uses the same interpolation variables', () => {
    const problems: string[] = [];
    for (const [key, enForms] of en) {
      const fiForms = fi.get(key) ?? [];
      const enVars = new Set(enForms.flatMap(placeholders));
      const fiVars = new Set(fiForms.flatMap(placeholders));
      const missing = [...enVars].filter((v) => !fiVars.has(v));
      const extra = [...fiVars].filter((v) => !enVars.has(v));
      if (missing.length || extra.length) problems.push(`${key}: missing ${missing} extra ${extra}`);
    }
    expect(problems).toEqual([]);
  });

  it('no translation is empty', () => {
    for (const [key, forms] of [...en, ...fi]) {
      for (const f of forms) expect(f.trim(), key).not.toBe('');
    }
  });
});

describe('translate', () => {
  it('interpolates and formats numbers per locale', () => {
    expect(translate('fi', 'common.rows', { count: 1234 })).toBe('1 234 riviä');
    expect(translate('en', 'common.rows', { count: 1234 })).toBe('1,234 rows');
  });

  it('selects plural forms', () => {
    expect(translate('fi', 'common.rows', { count: 1 })).toBe('1 rivi');
    expect(translate('en', 'common.rows', { count: 1 })).toBe('1 row');
    expect(translate('en', 'common.columns', { count: 0 })).toBe('0 columns');
  });

  it('returns the key for unknown keys', () => {
    expect(translate('fi', 'does.not.exist')).toBe('does.not.exist');
    expect(createT('en').dynamic('nav.data')).toBe('Data');
  });

  it('detects the locale from a language string', () => {
    expect(detectLocale('fi-FI,fi;q=0.9,en;q=0.8')).toBe('fi');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
});
