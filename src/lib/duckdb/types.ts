/** A row with values normalised to plain JS (see normalize.ts). */
export type Row = Record<string, unknown>;
export type CellValue = string | number | boolean | null;

/**
 * Minimal database interface. The browser implementation wraps DuckDB-WASM; tests use
 * @duckdb/node-api. All ingest, ETL and chart code depends only on this interface.
 */
export interface QueryRunner {
  /** Runs a query and returns normalised rows. */
  query<T extends Row = Row>(sql: string): Promise<T[]>;
  /** Runs a statement without results. */
  exec(sql: string): Promise<void>;
  /** Registers text as a virtual file (for read_csv / read_json). */
  registerText(name: string, text: string): Promise<void>;
  /** Registers bytes as a virtual file (for read_parquet). */
  registerBuffer(name: string, bytes: Uint8Array): Promise<void>;
  /** Removes a virtual file. */
  dropFile(name: string): Promise<void>;
  /**
   * Creates `table` with `__row BIGINT` plus the given columns, all VARCHAR, from a string matrix.
   * Row numbers start at 1 in matrix order.
   */
  createStringTable(table: string, columns: string[], rows: Array<Array<string | null>>): Promise<void>;
  /** Writes the result of COPY … TO name and returns the bytes (exports). */
  copyToBuffer(selectSql: string, format: 'parquet' | 'csv', options?: string): Promise<Uint8Array>;
}
