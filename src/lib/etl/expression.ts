import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import { closest } from '@/lib/util/levenshtein';
import type { ColumnType } from '@/types/domain';

/**
 * Safe formula language for calculated columns (9.5). Parsed with a tokenizer and a Pratt parser and
 * compiled to SQL; raw SQL is never accepted. Column references use display names: [Myynti].
 */
export type ExprType = 'number' | 'text' | 'date' | 'boolean' | 'null';

export class ExpressionError extends Error {
  constructor(
    readonly key: string,
    readonly params: Record<string, string | number>,
    readonly position: number,
  ) {
    super(key);
  }
}

type Token =
  | { t: 'num'; v: number; pos: number }
  | { t: 'str'; v: string; pos: number }
  | { t: 'col'; v: string; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'eof'; pos: number };

const OPERATORS = ['<=', '>=', '<>', '!=', '+', '-', '*', '/', '%', '(', ')', ',', '=', '<', '>'];

export function tokenize(src: string, locale: 'fi' | 'en' = 'en'): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /\d/.test(src[j])) j++;
      // Decimal: a dot, or (Finnish) a comma directly between digits.
      if ((src[j] === '.' || (locale === 'fi' && src[j] === ',')) && /\d/.test(src[j + 1] ?? '')) {
        j++;
        while (j < src.length && /\d/.test(src[j])) j++;
      }
      if (/[eE]/.test(src[j] ?? '') && /[-+\d]/.test(src[j + 1] ?? '')) {
        let k = j + 1;
        if (/[-+]/.test(src[k])) k++;
        if (/\d/.test(src[k] ?? '')) {
          j = k;
          while (j < src.length && /\d/.test(src[j])) j++;
        }
      }
      tokens.push({ t: 'num', v: Number(src.slice(i, j).replace(',', '.')), pos: i });
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let v = '';
      for (;;) {
        if (j >= src.length) throw new ExpressionError('expression.error.unterminatedString', {}, i);
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            v += '"';
            j += 2;
            continue;
          }
          break;
        }
        v += src[j++];
      }
      tokens.push({ t: 'str', v, pos: i });
      i = j + 1;
      continue;
    }
    if (ch === '[') {
      let j = i + 1;
      let v = '';
      for (;;) {
        if (j >= src.length) throw new ExpressionError('expression.error.unterminatedColumn', {}, i);
        if (src[j] === ']') {
          if (src[j + 1] === ']') {
            v += ']';
            j += 2;
            continue;
          }
          break;
        }
        v += src[j++];
      }
      tokens.push({ t: 'col', v, pos: i });
      i = j + 1;
      continue;
    }
    if (/[\p{L}_]/u.test(ch)) {
      let j = i;
      while (j < src.length && /[\p{L}\p{N}_]/u.test(src[j])) j++;
      tokens.push({ t: 'id', v: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      tokens.push({ t: 'op', v: op, pos: i });
      i += op.length;
      continue;
    }
    throw new ExpressionError('expression.error.unexpectedChar', { char: ch }, i);
  }
  tokens.push({ t: 'eof', pos: src.length });
  return tokens;
}

export type Node =
  | { k: 'num'; v: number; pos: number }
  | { k: 'str'; v: string; pos: number }
  | { k: 'bool'; v: boolean; pos: number }
  | { k: 'null'; pos: number }
  | { k: 'col'; name: string; pos: number }
  | { k: 'unary'; op: '-' | 'not'; arg: Node; pos: number }
  | { k: 'binary'; op: string; left: Node; right: Node; pos: number }
  | { k: 'call'; name: string; args: Node[]; pos: number };

const KEYWORD_ALIASES: Record<string, string> = { ja: 'and', tai: 'or', ei: 'not', tosi: 'true', epätosi: 'false' };

const BINDING: Record<string, number> = {
  or: 1,
  and: 2,
  '=': 4,
  '<>': 4,
  '!=': 4,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

export function parse(src: string, locale: 'fi' | 'en' = 'en'): Node {
  const tokens = tokenize(src, locale);
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const word = (tok: Token) => (tok.t === 'id' ? (KEYWORD_ALIASES[tok.v.toLowerCase()] ?? tok.v.toLowerCase()) : null);
  const opOf = (tok: Token): string | null => {
    if (tok.t === 'op' && tok.v in BINDING) return tok.v;
    const w = word(tok);
    return w === 'and' || w === 'or' ? w : null;
  };

  function expect(v: string) {
    const tok = next();
    if (tok.t !== 'op' || tok.v !== v) throw new ExpressionError('expression.error.expected', { token: v }, tok.pos);
  }

  function prefix(): Node {
    const tok = next();
    switch (tok.t) {
      case 'num':
        return { k: 'num', v: tok.v, pos: tok.pos };
      case 'str':
        return { k: 'str', v: tok.v, pos: tok.pos };
      case 'col':
        return { k: 'col', name: tok.v, pos: tok.pos };
      case 'op':
        if (tok.v === '(') {
          const inner = expr(0);
          expect(')');
          return inner;
        }
        if (tok.v === '-') return { k: 'unary', op: '-', arg: expr(7), pos: tok.pos };
        if (tok.v === '+') return expr(7);
        throw new ExpressionError('expression.error.unexpectedToken', { token: tok.v }, tok.pos);
      case 'id': {
        const w = word(tok)!;
        if (w === 'true' || w === 'false') return { k: 'bool', v: w === 'true', pos: tok.pos };
        if (w === 'null') return { k: 'null', pos: tok.pos };
        if (w === 'not') return { k: 'unary', op: 'not', arg: expr(3), pos: tok.pos };
        const after = peek();
        if (after.t === 'op' && after.v === '(') {
          next();
          const args: Node[] = [];
          if (!(peek().t === 'op' && (peek() as { v: string }).v === ')')) {
            for (;;) {
              args.push(expr(0));
              const sep = peek();
              if (sep.t === 'op' && sep.v === ',') {
                next();
                continue;
              }
              break;
            }
          }
          expect(')');
          return { k: 'call', name: tok.v.toUpperCase(), args, pos: tok.pos };
        }
        throw new ExpressionError('expression.error.unknownName', { name: tok.v }, tok.pos);
      }
      case 'eof':
        throw new ExpressionError('expression.error.unexpectedEnd', {}, tok.pos);
    }
  }

  function expr(minBp: number): Node {
    let left = prefix();
    for (;;) {
      const tok = peek();
      const op = opOf(tok);
      if (!op) break;
      const bp = BINDING[op];
      if (bp <= minBp) break;
      next();
      const right = expr(bp);
      left = { k: 'binary', op, left, right, pos: tok.pos };
    }
    return left;
  }

  const root = expr(0);
  const end = peek();
  if (end.t !== 'eof') {
    throw new ExpressionError('expression.error.unexpectedToken', { token: 'v' in end ? String(end.v) : '' }, end.pos);
  }
  return root;
}

export interface ExprColumn {
  displayName: string;
  sqlName: string;
  type: ColumnType | 'varchar';
}

interface Compiled {
  sql: string;
  type: ExprType;
}

const typeOfColumn = (t: ExprColumn['type']): ExprType =>
  t === 'integer' || t === 'decimal' ? 'number' : t === 'date' || t === 'datetime' ? 'date' : t === 'boolean' ? 'boolean' : 'text';

const DATE_UNITS: Record<string, string> = {
  day: 'day',
  days: 'day',
  päivä: 'day',
  päivät: 'day',
  week: 'week',
  viikko: 'week',
  month: 'month',
  kuukausi: 'month',
  quarter: 'quarter',
  kvartaali: 'quarter',
  year: 'year',
  vuosi: 'year',
};

type FnSpec = { min: number; max: number; compile: (args: Compiled[], nodes: Node[], pos: number) => Compiled };

const need = (a: Compiled, type: ExprType, pos: number, fn: string) => {
  if (a.type !== type && a.type !== 'null') throw new ExpressionError('expression.error.argumentType', { fn, type }, pos);
};

const FUNCTIONS: Record<string, FnSpec> = {
  ROUND: {
    min: 1,
    max: 2,
    compile: (a, n, pos) => {
      need(a[0], 'number', pos, 'ROUND');
      if (a[1]) need(a[1], 'number', pos, 'ROUND');
      return { sql: `round(${a[0].sql}, CAST(${a[1]?.sql ?? '0'} AS INTEGER))`, type: 'number' };
    },
  },
  ABS: { min: 1, max: 1, compile: (a, _n, pos) => (need(a[0], 'number', pos, 'ABS'), { sql: `abs(${a[0].sql})`, type: 'number' }) },
  MIN: { min: 2, max: 20, compile: (a) => ({ sql: `least(${a.map((x) => x.sql).join(', ')})`, type: a[0].type }) },
  MAX: { min: 2, max: 20, compile: (a) => ({ sql: `greatest(${a.map((x) => x.sql).join(', ')})`, type: a[0].type }) },
  IF: {
    min: 3,
    max: 3,
    compile: (a, _n, pos) => {
      need(a[0], 'boolean', pos, 'IF');
      const type = a[1].type === 'null' ? a[2].type : a[1].type;
      return { sql: `(CASE WHEN ${a[0].sql} THEN ${a[1].sql} ELSE ${a[2].sql} END)`, type };
    },
  },
  COALESCE: {
    min: 1,
    max: 20,
    compile: (a) => ({ sql: `coalesce(${a.map((x) => x.sql).join(', ')})`, type: a.find((x) => x.type !== 'null')?.type ?? 'null' }),
  },
  YEAR: { min: 1, max: 1, compile: (a, _n, pos) => (need(a[0], 'date', pos, 'YEAR'), { sql: `year(${a[0].sql})`, type: 'number' }) },
  MONTH: { min: 1, max: 1, compile: (a, _n, pos) => (need(a[0], 'date', pos, 'MONTH'), { sql: `month(${a[0].sql})`, type: 'number' }) },
  QUARTER: { min: 1, max: 1, compile: (a, _n, pos) => (need(a[0], 'date', pos, 'QUARTER'), { sql: `quarter(${a[0].sql})`, type: 'number' }) },
  WEEKDAY: { min: 1, max: 1, compile: (a, _n, pos) => (need(a[0], 'date', pos, 'WEEKDAY'), { sql: `isodow(${a[0].sql})`, type: 'number' }) },
  DATEDIFF: {
    min: 3,
    max: 3,
    compile: (a, n, pos) => {
      const unitNode = n[0];
      const unit = unitNode.k === 'str' ? DATE_UNITS[unitNode.v.toLowerCase()] : undefined;
      if (!unit) throw new ExpressionError('expression.error.dateUnit', {}, pos);
      need(a[1], 'date', pos, 'DATEDIFF');
      need(a[2], 'date', pos, 'DATEDIFF');
      return { sql: `date_diff(${sqlLiteral(unit)}, ${a[1].sql}, ${a[2].sql})`, type: 'number' };
    },
  },
  UPPER: { min: 1, max: 1, compile: (a) => ({ sql: `upper(CAST(${a[0].sql} AS VARCHAR))`, type: 'text' }) },
  LOWER: { min: 1, max: 1, compile: (a) => ({ sql: `lower(CAST(${a[0].sql} AS VARCHAR))`, type: 'text' }) },
  CONCAT: { min: 1, max: 20, compile: (a) => ({ sql: `concat(${a.map((x) => x.sql).join(', ')})`, type: 'text' }) },
  LEFT: {
    min: 2,
    max: 2,
    compile: (a, _n, pos) => (need(a[1], 'number', pos, 'LEFT'), { sql: `left(CAST(${a[0].sql} AS VARCHAR), CAST(${a[1].sql} AS INTEGER))`, type: 'text' }),
  },
  RIGHT: {
    min: 2,
    max: 2,
    compile: (a, _n, pos) => (need(a[1], 'number', pos, 'RIGHT'), { sql: `right(CAST(${a[0].sql} AS VARCHAR), CAST(${a[1].sql} AS INTEGER))`, type: 'text' }),
  },
  LEN: { min: 1, max: 1, compile: (a) => ({ sql: `length(CAST(${a[0].sql} AS VARCHAR))`, type: 'number' }) },
  CONTAINS: {
    min: 2,
    max: 2,
    compile: (a) => ({ sql: `contains(lower(CAST(${a[0].sql} AS VARCHAR)), lower(CAST(${a[1].sql} AS VARCHAR)))`, type: 'boolean' }),
  },
  DATE: {
    min: 1,
    max: 1,
    compile: (_a, n, pos) => {
      const node = n[0];
      if (node.k !== 'str' || !/^\d{4}-\d{2}-\d{2}$/.test(node.v) || Number.isNaN(Date.parse(`${node.v}T00:00:00Z`))) {
        throw new ExpressionError('expression.error.dateLiteral', {}, pos);
      }
      return { sql: `DATE ${sqlLiteral(node.v)}`, type: 'date' };
    },
  },
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

/** Compiles an expression to SQL and infers its result type. */
export function compileExpression(src: string, columns: ExprColumn[], locale: 'fi' | 'en' = 'en'): Compiled {
  if (!src.trim()) throw new ExpressionError('expression.error.empty', {}, 0);
  const byName = new Map(columns.map((c) => [c.displayName.toLowerCase(), c]));
  const walk = (node: Node): Compiled => {
    switch (node.k) {
      case 'num':
        return { sql: sqlLiteral(node.v), type: 'number' };
      case 'str':
        return { sql: sqlLiteral(node.v), type: 'text' };
      case 'bool':
        return { sql: node.v ? 'TRUE' : 'FALSE', type: 'boolean' };
      case 'null':
        return { sql: 'NULL', type: 'null' };
      case 'col': {
        const col = byName.get(node.name.toLowerCase());
        if (!col) {
          const suggestion = closest(node.name, columns.map((c) => c.displayName));
          throw new ExpressionError(
            suggestion ? 'expression.error.unknownColumnSuggest' : 'expression.error.unknownColumn',
            suggestion ? { name: node.name, suggestion } : { name: node.name },
            node.pos,
          );
        }
        return { sql: quoteIdent(col.sqlName), type: typeOfColumn(col.type) };
      }
      case 'unary': {
        const arg = walk(node.arg);
        if (node.op === '-') {
          need(arg, 'number', node.pos, '-');
          return { sql: `(-${arg.sql})`, type: 'number' };
        }
        need(arg, 'boolean', node.pos, 'not');
        return { sql: `(NOT ${arg.sql})`, type: 'boolean' };
      }
      case 'binary': {
        const l = walk(node.left);
        const r = walk(node.right);
        const op = node.op;
        if (op === 'and' || op === 'or') {
          need(l, 'boolean', node.pos, op);
          need(r, 'boolean', node.pos, op);
          return { sql: `(${l.sql} ${op.toUpperCase()} ${r.sql})`, type: 'boolean' };
        }
        if (['=', '<>', '!=', '<', '<=', '>', '>='].includes(op)) {
          if (l.type !== r.type && l.type !== 'null' && r.type !== 'null') {
            throw new ExpressionError('expression.error.compareTypes', {}, node.pos);
          }
          return { sql: `(${l.sql} ${op === '!=' ? '<>' : op} ${r.sql})`, type: 'boolean' };
        }
        // Date ± number of days
        if ((op === '+' || op === '-') && l.type === 'date' && r.type === 'number') {
          return { sql: `CAST(${l.sql} ${op} to_days(CAST(${r.sql} AS INTEGER)) AS DATE)`, type: 'date' };
        }
        if (op === '-' && l.type === 'date' && r.type === 'date') {
          return { sql: `date_diff('day', ${r.sql}, ${l.sql})`, type: 'number' };
        }
        if (l.type === 'text' || r.type === 'text') throw new ExpressionError('expression.error.textArithmetic', {}, node.pos);
        need(l, 'number', node.pos, op);
        need(r, 'number', node.pos, op);
        if (op === '/') return { sql: `(CAST(${l.sql} AS DOUBLE) / nullif(${r.sql}, 0))`, type: 'number' };
        if (op === '%') return { sql: `(${l.sql} % nullif(${r.sql}, 0))`, type: 'number' };
        return { sql: `(${l.sql} ${op} ${r.sql})`, type: 'number' };
      }
      case 'call': {
        const fn = FUNCTIONS[node.name];
        if (!fn) {
          const suggestion = closest(node.name, FUNCTION_NAMES);
          throw new ExpressionError(
            suggestion ? 'expression.error.unknownFunctionSuggest' : 'expression.error.unknownFunction',
            suggestion ? { name: node.name, suggestion } : { name: node.name },
            node.pos,
          );
        }
        if (node.args.length < fn.min || node.args.length > fn.max) {
          throw new ExpressionError('expression.error.arity', { name: node.name, min: fn.min, max: fn.max }, node.pos);
        }
        const args = node.name === 'DATEDIFF' ? [{ sql: '', type: 'text' as ExprType }, ...node.args.slice(1).map(walk)] : node.args.map(walk);
        return fn.compile(args, node.args, node.pos);
      }
    }
  };
  return walk(parse(src, locale));
}

/** SQL type and column type for an expression result. */
export function resultColumnType(type: ExprType): ColumnType {
  return type === 'number' ? 'decimal' : type === 'date' ? 'date' : type === 'boolean' ? 'boolean' : 'text';
}
