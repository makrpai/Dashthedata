import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import type { QueryRunner } from '@/lib/duckdb/types';
import type { ColumnType } from '@/types/domain';

/** Maps a DuckDB type name to a ColumnType (14.1). */
export function duckTypeToColumnType(type: string): ColumnType {
  const t = type.toUpperCase();
  if (t === 'BOOLEAN') return 'boolean';
  if (/^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|UHUGEINT)$/.test(t)) return 'integer';
  if (/^(FLOAT|DOUBLE|REAL)$/.test(t) || t.startsWith('DECIMAL')) return 'decimal';
  if (t === 'DATE') return 'date';
  if (t.startsWith('TIMESTAMP')) return 'datetime';
  return 'text';
}

export interface TypedIngestResult {
  rowCount: number;
  columnNames: string[];
  columnTypes: ColumnType[];
}

/**
 * Loads a typed table (Parquet) into `table`: columns renamed to c0…cN, original names kept
 * in the result, `__row` from the file row number (7.5).
 */
export async function ingestParquetFile(
  runner: QueryRunner,
  opts: { virtualName: string; table: string },
): Promise<TypedIngestResult> {
  const src = `read_parquet(${sqlLiteral(opts.virtualName)}, file_row_number = true)`;
  const described = await runner.query<{ column_name: string; column_type: string }>(`DESCRIBE SELECT * FROM ${src}`);
  const cols = described.filter((c) => c.column_name !== 'file_row_number');
  return createTypedTable(runner, opts.table, src, cols, 'file_row_number + 1');
}

/** Shared by Parquet and database sources: renames columns and maps types. */
export async function createTypedTable(
  runner: QueryRunner,
  table: string,
  fromSql: string,
  cols: Array<{ column_name: string; column_type: string }>,
  rowExpr: string,
): Promise<TypedIngestResult> {
  const columnTypes = cols.map((c) => duckTypeToColumnType(c.column_type));
  const select = [
    `CAST(${rowExpr} AS BIGINT) AS "__row"`,
    ...cols.map((c, i) => {
      const expr = quoteIdent(c.column_name);
      // Keep native types but normalise to the set the app understands.
      const cast =
        columnTypes[i] === 'integer'
          ? `CAST(${expr} AS BIGINT)`
          : columnTypes[i] === 'decimal'
            ? `CAST(${expr} AS DOUBLE)`
            : columnTypes[i] === 'datetime'
              ? `CAST(${expr} AS TIMESTAMP)`
              : columnTypes[i] === 'text'
                ? `CAST(${expr} AS VARCHAR)`
                : expr;
      return `${cast} AS ${quoteIdent(`c${i}`)}`;
    }),
  ];
  await runner.exec(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);
  await runner.exec(`CREATE TABLE ${quoteIdent(table)} AS SELECT ${select.join(', ')} FROM ${fromSql} ORDER BY 1`);
  const [{ n }] = await runner.query<{ n: number }>(`SELECT count(*) AS n FROM ${quoteIdent(table)}`);
  return { rowCount: Number(n), columnNames: cols.map((c) => c.column_name), columnTypes };
}
