import { describe, expect, it } from 'vitest';
import { likeEscape, quoteIdent, sqlList, sqlLiteral } from '@/lib/duckdb/sql';
import { TaskQueue } from '@/lib/duckdb/queue';

describe('quoteIdent', () => {
  it('wraps and doubles quotes', () => {
    expect(quoteIdent('myynti')).toBe('"myynti"');
    expect(quoteIdent('a"b')).toBe('"a""b"');
    expect(quoteIdent('x"; DROP TABLE t; --')).toBe('"x""; DROP TABLE t; --"');
  });
  it('rejects empty and NUL', () => {
    expect(() => quoteIdent('')).toThrow();
    expect(() => quoteIdent('a\u0000b')).toThrow();
  });
});

describe('sqlLiteral', () => {
  it('quotes strings and doubles single quotes', () => {
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'");
    expect(sqlLiteral("'; DROP TABLE x; --")).toBe("'''; DROP TABLE x; --'");
  });
  it('renders numbers, booleans, null', () => {
    expect(sqlLiteral(12.5)).toBe('12.5');
    expect(sqlLiteral(-3)).toBe('-3');
    expect(sqlLiteral(true)).toBe('TRUE');
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(undefined)).toBe('NULL');
    expect(sqlLiteral(10n)).toBe('10');
  });
  it('rejects non-finite numbers', () => {
    expect(() => sqlLiteral(Number.NaN)).toThrow();
    expect(() => sqlLiteral(Infinity)).toThrow();
  });
  it('builds lists', () => {
    expect(sqlList(['a', 1])).toBe("('a', 1)");
    expect(sqlList([])).toBe('(NULL)');
  });
  it('escapes LIKE patterns', () => {
    expect(likeEscape('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('TaskQueue', () => {
  it('runs tasks one at a time in order, even when one fails', async () => {
    const q = new TaskQueue();
    const log: string[] = [];
    const slow = (name: string, ms: number) => async () => {
      log.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`end ${name}`);
      return name;
    };
    const a = q.run(slow('a', 20));
    const b = q.run(async () => {
      throw new Error('boom');
    });
    const c = q.run(slow('c', 1));
    await expect(a).resolves.toBe('a');
    await expect(b).rejects.toThrow('boom');
    await expect(c).resolves.toBe('c');
    expect(log).toEqual(['start a', 'end a', 'start c', 'end c']);
    expect(q.size).toBe(0);
  });
});
