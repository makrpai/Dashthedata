import { beforeAll, describe, expect, it } from 'vitest';
import { compileExpression, ExpressionError, parse, type ExprColumn } from '@/lib/etl/expression';
import { NodeRunner } from '../../helpers/nodeRunner';

const COLUMNS: ExprColumn[] = [
  { displayName: 'Myynti', sqlName: 'myynti', type: 'decimal' },
  { displayName: 'Kpl', sqlName: 'kpl', type: 'integer' },
  { displayName: 'Alue', sqlName: 'alue', type: 'text' },
  { displayName: 'Pvm', sqlName: 'pvm', type: 'date' },
  { displayName: 'Loppu', sqlName: 'loppu', type: 'date' },
  { displayName: 'Aktiivinen', sqlName: 'aktiivinen', type: 'boolean' },
  { displayName: 'Hinta (€)', sqlName: 'hinta_eur', type: 'decimal' },
  { displayName: 'a]b', sqlName: 'a_b', type: 'text' },
];

let db: NodeRunner;
beforeAll(async () => {
  db = await NodeRunner.create();
  await db.exec(`CREATE TABLE t AS SELECT 1200.5::DOUBLE AS myynti, 4 AS kpl, 'Tampere' AS alue, DATE '2025-03-15' AS pvm,
    DATE '2025-04-01' AS loppu, true AS aktiivinen, 49.9::DOUBLE AS hinta_eur, 'x' AS a_b`);
});

async function evaluate(src: string, locale: 'fi' | 'en' = 'fi') {
  const { sql, type } = compileExpression(src, COLUMNS, locale);
  const [row] = await db.query<{ v: unknown }>(`SELECT ${sql} AS v FROM t`);
  return { v: row.v, type };
}

const OK: Array<[string, unknown, string]> = [
  ['[Myynti] * 2', 2401, 'number'],
  ['[Myynti] / [Kpl]', 300.125, 'number'],
  ['[Kpl] / 0', null, 'number'],
  ['7 % 3', 1, 'number'],
  ['-[Kpl] + 10', 6, 'number'],
  ['(1 + 2) * 3', 9, 'number'],
  ['1 + 2 * 3', 7, 'number'],
  ['ROUND([Myynti] / 7, 2)', 171.5, 'number'],
  ['round(2.567)', 3, 'number'],
  ['ABS(-5)', 5, 'number'],
  ['MIN([Kpl], 2)', 2, 'number'],
  ['MAX([Kpl], 2, 9)', 9, 'number'],
  ['IF([Myynti] > 1000, "iso", "pieni")', 'iso', 'text'],
  ['IF([Kpl] >= 4 ja [Aktiivinen], 1, 0)', 1, 'number'],
  ['[Kpl] > 1 tai ei [Aktiivinen]', true, 'boolean'],
  ['not [Aktiivinen]', false, 'boolean'],
  ['COALESCE(null, [Kpl])', 4, 'number'],
  ['YEAR([Pvm])', 2025, 'number'],
  ['MONTH([Pvm])', 3, 'number'],
  ['QUARTER([Pvm])', 1, 'number'],
  ['WEEKDAY([Pvm])', 6, 'number'],
  ['DATEDIFF("day", [Pvm], [Loppu])', 17, 'number'],
  ['DATEDIFF("kuukausi", [Pvm], [Loppu])', 1, 'number'],
  ['[Loppu] - [Pvm]', 17, 'number'],
  ['[Pvm] + 1', '2025-03-16', 'date'],
  ['UPPER([Alue])', 'TAMPERE', 'text'],
  ['LOWER("ÄÖ")', 'äö', 'text'],
  ['CONCAT([Alue], " / ", [Kpl])', 'Tampere / 4', 'text'],
  ['LEFT([Alue], 3)', 'Tam', 'text'],
  ['RIGHT([Alue], 3)', 'ere', 'text'],
  ['LEN([Alue])', 7, 'number'],
  ['CONTAINS([Alue], "mpe")', true, 'boolean'],
  ['[Pvm] < DATE("2025-06-01")', true, 'boolean'],
  ['[Alue] = "Tampere"', true, 'boolean'],
  ['[Alue] <> "Oulu"', true, 'boolean'],
  ['[Hinta (€)] * 1,5', 74.85, 'number'],
  ['[myynti] + 0.5', 1201, 'number'],
  ['"Say ""hi"""', 'Say "hi"', 'text'],
  ['[a]]b]', 'x', 'text'],
  ['1e3 + 1', 1001, 'number'],
];

describe('expression language (9.5)', () => {
  it.each(OK)('%s', async (src, expected, type) => {
    const r = await evaluate(src);
    expect(r.type).toBe(type);
    if (typeof expected === 'number') expect(r.v as number).toBeCloseTo(expected, 6);
    else expect(r.v).toEqual(expected);
  });

  const ERR: Array<[string, string]> = [
    ['[Myyntti] * 2', 'expression.error.unknownColumnSuggest'],
    ['[Nope] + 1', 'expression.error.unknownColumn'],
    ['ROUNDD(1)', 'expression.error.unknownFunctionSuggest'],
    ['1 +', 'expression.error.unexpectedEnd'],
    ['(1 + 2', 'expression.error.expected'],
    ['"abc', 'expression.error.unterminatedString'],
    ['[abc', 'expression.error.unterminatedColumn'],
    ['[Alue] * 2', 'expression.error.textArithmetic'],
    ['ABS(1, 2)', 'expression.error.arity'],
    ['IF(1, 2, 3)', 'expression.error.argumentType'],
    ['[Alue] = 1', 'expression.error.compareTypes'],
    ['DATE("31.12.2025")', 'expression.error.dateLiteral'],
    ['DATEDIFF("fortnight", [Pvm], [Loppu])', 'expression.error.dateUnit'],
    ['1 # 2', 'expression.error.unexpectedChar'],
    ['foo', 'expression.error.unknownName'],
    ['', 'expression.error.empty'],
    // Injection attempts never reach SQL.
    ['[x]"; DROP TABLE t; --', 'expression.error.unterminatedString'],
    ["1; DROP TABLE t", 'expression.error.unexpectedChar'],
    ["' OR 1=1 --", 'expression.error.unexpectedChar'],
    ['SELECT(1)', 'expression.error.unknownFunction'],
  ];
  it.each(ERR)('rejects %s', (src, key) => {
    try {
      compileExpression(src, COLUMNS, 'fi');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ExpressionError);
      expect((err as ExpressionError).key).toBe(key);
    }
  });

  it('points to the error position and suggests a column', () => {
    try {
      compileExpression('1 + [Myyntti]', COLUMNS);
    } catch (err) {
      const e = err as ExpressionError;
      expect(e.position).toBe(4);
      expect(e.params).toEqual({ name: 'Myyntti', suggestion: 'Myynti' });
    }
  });

  it('column names with quotes cannot break out of identifiers', async () => {
    const cols: ExprColumn[] = [{ displayName: 'evil', sqlName: 'x"; DROP TABLE t; --', type: 'text' }];
    expect(compileExpression('[evil]', cols).sql).toBe('"x""; DROP TABLE t; --"');
  });

  it('comma decimals only in Finnish', () => {
    expect(parse('1,5', 'fi')).toMatchObject({ k: 'num', v: 1.5 });
    expect(() => parse('1,5', 'en')).toThrow(ExpressionError);
  });
});
