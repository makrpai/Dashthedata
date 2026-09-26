import type { QueryRunner } from '@/lib/duckdb/types';
import { rawColumnNames, rectangular } from './values';

/** Loads a string matrix (Excel sheet, JSON records) as a raw table c0…cN + __row. */
export async function ingestMatrix(
  runner: QueryRunner,
  table: string,
  matrix: Array<Array<string | null>>,
): Promise<{ rowCount: number; columnCount: number }> {
  const { width, rows } = rectangular(matrix);
  await runner.createStringTable(table, rawColumnNames(width), rows);
  return { rowCount: rows.length, columnCount: width };
}
