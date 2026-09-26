import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeValue, type LogicalKind } from '@/lib/duckdb/normalize';
import { quoteIdent, sqlLiteral } from '@/lib/duckdb/sql';
import type { QueryRunner, Row } from '@/lib/duckdb/types';

/**
 * QueryRunner backed by @duckdb/node-api. Virtual files are written to a temp directory and
 * the file name is rewritten, so ingest code uses exactly the same SQL as in the browser.
 */
export class NodeRunner implements QueryRunner {
  private readonly dir = mkdtempSync(join(tmpdir(), 'dtd-'));
  private readonly files = new Map<string, string>();

  private constructor(private readonly conn: DuckDBConnection) {}

  static async create(): Promise<NodeRunner> {
    const instance = await DuckDBInstance.create(':memory:');
    return new NodeRunner(await instance.connect());
  }

  private rewrite(sql: string): string {
    let out = sql;
    for (const [name, path] of this.files) out = out.split(`'${name}'`).join(sqlLiteral(path));
    return out;
  }

  async query<T extends Row = Row>(sql: string): Promise<T[]> {
    const reader = await this.conn.runAndReadAll(this.rewrite(sql));
    const kinds: LogicalKind[] = reader.columnTypes().map((t) => {
      const s = t.toString();
      if (s === 'DATE') return 'date';
      if (s.startsWith('TIMESTAMP')) return 'timestamp';
      return 'other';
    });
    const names = reader.columnNames();
    return reader.getRowsJS().map((values) => {
      const row: Row = {};
      values.forEach((v, i) => {
        row[names[i]] = normalizeValue(v, kinds[i]);
      });
      return row as T;
    });
  }

  async exec(sql: string): Promise<void> {
    await this.conn.run(this.rewrite(sql));
  }

  async registerText(name: string, text: string): Promise<void> {
    const path = join(this.dir, name.replace(/[^\w.-]/g, '_'));
    writeFileSync(path, text, 'utf8');
    this.files.set(name, path);
  }

  async registerBuffer(name: string, bytes: Uint8Array): Promise<void> {
    const path = join(this.dir, name.replace(/[^\w.-]/g, '_'));
    writeFileSync(path, bytes);
    this.files.set(name, path);
  }

  async dropFile(name: string): Promise<void> {
    const path = this.files.get(name);
    if (path) rmSync(path, { force: true });
    this.files.delete(name);
  }

  async createStringTable(table: string, columns: string[], rows: Array<Array<string | null>>): Promise<void> {
    const cols = ['"__row" BIGINT', ...columns.map((c) => `${quoteIdent(c)} VARCHAR`)].join(', ');
    await this.exec(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);
    await this.exec(`CREATE TABLE ${quoteIdent(table)} (${cols})`);
    const batch = 500;
    for (let start = 0; start < rows.length; start += batch) {
      const values = rows
        .slice(start, start + batch)
        .map((r, i) => `(${[start + i + 1, ...columns.map((_, c) => sqlLiteral(r[c] ?? null))].join(', ')})`)
        .join(', ');
      await this.exec(`INSERT INTO ${quoteIdent(table)} VALUES ${values}`);
    }
  }

  async copyToBuffer(selectSql: string, format: 'parquet' | 'csv', options = ''): Promise<Uint8Array> {
    const path = join(this.dir, `export_${Date.now()}.${format}`);
    const fmt = format === 'parquet' ? 'FORMAT PARQUET' : `FORMAT CSV${options ? `, ${options}` : ''}`;
    await this.exec(`COPY (${selectSql}) TO ${sqlLiteral(path)} (${fmt})`);
    const bytes = readFileSync(path);
    rmSync(path, { force: true });
    return new Uint8Array(bytes);
  }
}
