import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';

export const DELIMITER_CANDIDATES = [';', ',', '\t', '|'] as const;

/** Counts delimiter occurrences per line outside double quotes (first `maxLines` lines). */
function countsPerLine(text: string, delimiter: string, maxLines = 50): number[] {
  const counts: number[] = [];
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < text.length && counts.length < maxLines; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delimiter) {
      count++;
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      counts.push(count);
      count = 0;
    }
  }
  if (count > 0 || (counts.length < maxLines && text.length > 0 && !/[\r\n]$/.test(text))) counts.push(count);
  return counts;
}

/**
 * Consistency score of a delimiter: how evenly it splits the first 50 lines. Lines with zero
 * delimiters (titles, blank lines) weigh less so header offsets do not break detection.
 */
export function delimiterScore(text: string, delimiter: string): number {
  const counts = countsPerLine(text, delimiter).filter((c) => c > 0);
  if (counts.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
  const [mode, modeCount] = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  // share of lines with the modal count, weighted by how many columns it produces
  return (modeCount / counts.length) * Math.log2(mode + 1) * (counts.length >= 2 ? 1 : 0.5);
}

/** Picks the delimiter in the order ; , \t | with the most consistent column count (7.3). */
export function guessDelimiter(text: string): string {
  let best: string = ',';
  let bestScore = 0;
  for (const d of DELIMITER_CANDIDATES) {
    const score = delimiterScore(text, d);
    if (score > bestScore + 1e-9) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export interface CsvIngestResult {
  rowCount: number;
  columnCount: number;
  delimiter: string;
}

/**
 * Loads a registered CSV file into `table` with columns c0…cN (all VARCHAR) plus `__row`.
 * The header row is NOT interpreted here; promoteHeader detection does that (7.1).
 */
export async function ingestCsvFile(
  runner: QueryRunner,
  opts: { virtualName: string; table: string; sample: string; delimiter?: string },
): Promise<CsvIngestResult> {
  let delimiter = opts.delimiter;
  if (!delimiter) {
    const guessed = guessDelimiter(opts.sample);
    let sniffed: string | undefined;
    try {
      const rows = await runner.query<{ Delimiter: string }>(
        `SELECT "Delimiter" FROM sniff_csv(${sqlLiteral(opts.virtualName)}, header = false, sample_size = 20480)`,
      );
      sniffed = rows[0]?.Delimiter;
    } catch {
      sniffed = undefined;
    }
    delimiter =
      sniffed && sniffed.length === 1 && delimiterScore(opts.sample, sniffed) >= delimiterScore(opts.sample, guessed)
        ? sniffed
        : guessed;
  }

  const tmp = `${opts.table}__csv`;
  await runner.exec(`DROP TABLE IF EXISTS ${quoteIdent(tmp)}`);
  await runner.exec(
    `CREATE TABLE ${quoteIdent(tmp)} AS SELECT * FROM read_csv(${sqlLiteral(opts.virtualName)}, ` +
      `delim = ${sqlLiteral(delimiter)}, quote = '"', escape = '"', header = false, all_varchar = true, ` +
      `null_padding = true, ignore_errors = false, auto_detect = true, sample_size = -1)`,
  );
  const described = await runner.query<{ column_name: string }>(`DESCRIBE ${quoteIdent(tmp)}`);
  const select = [
    'CAST(rowid + 1 AS BIGINT) AS "__row"',
    ...described.map((c, i) => `CAST(${quoteIdent(c.column_name)} AS VARCHAR) AS ${quoteIdent(`c${i}`)}`),
  ];
  await runner.exec(`DROP TABLE IF EXISTS ${quoteIdent(opts.table)}`);
  await runner.exec(
    `CREATE TABLE ${quoteIdent(opts.table)} AS SELECT ${select.join(', ')} FROM ${quoteIdent(tmp)} ORDER BY rowid`,
  );
  await runner.exec(`DROP TABLE IF EXISTS ${quoteIdent(tmp)}`);
  const [{ n }] = await runner.query<{ n: number }>(`SELECT count(*) AS n FROM ${quoteIdent(opts.table)}`);
  return { rowCount: Number(n), columnCount: described.length, delimiter };
}
