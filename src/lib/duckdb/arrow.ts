import { DataType, type Table } from 'apache-arrow';
import { isoDate, isoDateTime, normalizeValue } from './normalize';
import type { Row } from './types';

/** Converts an Arrow Decimal value (little-endian 32-bit words) to a number. */
function decimalToNumber(words: Uint32Array, scale: number): number {
  let negative = false;
  const w = Array.from(words);
  if (w.length > 0 && (w[w.length - 1] & 0x80000000) !== 0) {
    negative = true;
    // two's complement
    let carry = 1;
    for (let i = 0; i < w.length; i++) {
      const inv = (~w[i] >>> 0) + carry;
      w[i] = inv >>> 0;
      carry = inv > 0xffffffff ? 1 : 0;
    }
  }
  let big = 0n;
  for (let i = w.length - 1; i >= 0; i--) big = (big << 32n) + BigInt(w[i]);
  const n = Number(big) / 10 ** scale;
  return negative ? -n : n;
}

/** Converts a DuckDB-WASM Arrow result into plain rows (dates as ISO strings, bigints as numbers). */
export function arrowTableToRows(table: Table): Row[] {
  const fields = table.schema.fields;
  const columns = fields.map((f) => table.getChild(f.name));
  const rows: Row[] = new Array(table.numRows);
  for (let r = 0; r < table.numRows; r++) {
    const row: Row = {};
    for (let c = 0; c < fields.length; c++) {
      const field = fields[c];
      const raw: unknown = columns[c]?.get(r);
      const type = field.type;
      if (raw === null || raw === undefined) {
        row[field.name] = null;
      } else if (DataType.isDate(type)) {
        row[field.name] = isoDate(raw instanceof Date ? raw.getTime() : Number(raw));
      } else if (DataType.isTimestamp(type)) {
        const unit = (type as { unit: number }).unit; // 0 s, 1 ms, 2 µs, 3 ns
        const ms =
          typeof raw === 'bigint'
            ? Number(raw) / [1 / 1000, 1, 1000, 1_000_000][unit]
            : Number(raw instanceof Date ? raw.getTime() : raw);
        row[field.name] = isoDateTime(ms);
      } else if (DataType.isDecimal(type)) {
        const scale = (type as { scale: number }).scale;
        row[field.name] = raw instanceof Uint32Array ? decimalToNumber(raw, scale) : Number(raw);
      } else {
        row[field.name] = normalizeValue(raw);
      }
    }
    rows[r] = row;
  }
  return rows;
}
