'use client';

import * as duckdb from '@duckdb/duckdb-wasm';
import { Int32, Table, Utf8, makeVector, vectorFromArray, type Vector } from 'apache-arrow';
import { arrowTableToRows } from './arrow';
import { TaskQueue } from './queue';
import { quoteIdent } from './sql';
import type { QueryRunner, Row } from './types';

/** Self-hosted bundles copied to /public/duckdb by scripts/copy-duckdb-assets.mjs. */
function bundles(): duckdb.DuckDBBundles {
  const base = `${window.location.origin}/duckdb`;
  return {
    mvp: { mainModule: `${base}/duckdb-mvp.wasm`, mainWorker: `${base}/duckdb-browser-mvp.worker.js` },
    eh: { mainModule: `${base}/duckdb-eh.wasm`, mainWorker: `${base}/duckdb-browser-eh.worker.js` },
  };
}

interface DuckDBHandle {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  runner: BrowserRunner;
  initMs: number;
}

let handlePromise: Promise<DuckDBHandle> | null = null;

async function init(): Promise<DuckDBHandle> {
  const started = performance.now();
  const bundle = await duckdb.selectBundle(bundles());
  if (!bundle.mainWorker) throw new Error('DuckDB worker bundle missing');
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.VoidLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  await db.open({
    query: { castBigIntToDouble: true, castDecimalToDouble: true },
  });
  const conn = await db.connect();
  const runner = new BrowserRunner(db, conn);
  return { db, conn, runner, initMs: performance.now() - started };
}

/** Singleton DuckDB-WASM instance. Only ever called in the browser. */
export function getDuckDB(): Promise<DuckDBHandle> {
  if (typeof window === 'undefined') throw new Error('DuckDB-WASM is only available in the browser');
  if (!handlePromise) {
    handlePromise = init().catch((err) => {
      handlePromise = null;
      throw err;
    });
  }
  return handlePromise;
}

export async function getRunner(): Promise<BrowserRunner> {
  return (await getDuckDB()).runner;
}

export class BrowserRunner implements QueryRunner {
  private queue = new TaskQueue();

  constructor(
    readonly db: duckdb.AsyncDuckDB,
    private readonly conn: duckdb.AsyncDuckDBConnection,
  ) {}

  query<T extends Row = Row>(sql: string): Promise<T[]> {
    return this.queue.run(async () => arrowTableToRows(await this.conn.query(sql)) as T[]);
  }

  exec(sql: string): Promise<void> {
    return this.queue.run(async () => {
      await this.conn.query(sql);
    });
  }

  registerText(name: string, text: string): Promise<void> {
    return this.queue.run(() => this.db.registerFileText(name, text));
  }

  registerBuffer(name: string, bytes: Uint8Array): Promise<void> {
    return this.queue.run(() => this.db.registerFileBuffer(name, bytes));
  }

  /** Registers a browser File without copying it into memory as text (large UTF-8 CSVs). */
  registerFile(name: string, file: File): Promise<void> {
    return this.queue.run(() =>
      this.db.registerFileHandle(name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true),
    );
  }

  dropFile(name: string): Promise<void> {
    return this.queue.run(async () => {
      await this.db.dropFile(name);
    });
  }

  createStringTable(table: string, columns: string[], rows: Array<Array<string | null>>): Promise<void> {
    return this.queue.run(async () => {
      const rowNumbers = Int32Array.from({ length: rows.length }, (_, i) => i + 1);
      const vectors: Record<string, Vector> = {
        __row: makeVector({ type: new Int32(), data: rowNumbers }),
      };
      columns.forEach((name, c) => {
        vectors[name] = vectorFromArray(
          rows.map((r) => r[c] ?? null),
          new Utf8(),
        );
      });
      const arrowTable = new Table(vectors);
      await this.conn.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);
      if (rows.length === 0) {
        const cols = ['"__row" BIGINT', ...columns.map((c) => `${quoteIdent(c)} VARCHAR`)].join(', ');
        await this.conn.query(`CREATE TABLE ${quoteIdent(table)} (${cols})`);
        return;
      }
      const tmp = `${table}__arrow`;
      await this.conn.insertArrowTable(arrowTable, { name: tmp, create: true });
      const select = [
        'CAST("__row" AS BIGINT) AS "__row"',
        ...columns.map((c) => `CAST(${quoteIdent(c)} AS VARCHAR) AS ${quoteIdent(c)}`),
      ];
      await this.conn.query(
        `CREATE TABLE ${quoteIdent(table)} AS SELECT ${select.join(', ')} FROM ${quoteIdent(tmp)} ORDER BY "__row"`,
      );
      await this.conn.query(`DROP TABLE IF EXISTS ${quoteIdent(tmp)}`);
    });
  }

  copyToBuffer(selectSql: string, format: 'parquet' | 'csv', options = ''): Promise<Uint8Array> {
    return this.queue.run(async () => {
      const name = `export_${Date.now()}.${format}`;
      const fmt = format === 'parquet' ? 'FORMAT PARQUET' : `FORMAT CSV${options ? `, ${options}` : ''}`;
      await this.conn.query(`COPY (${selectSql}) TO '${name}' (${fmt})`);
      const bytes = await this.db.copyFileToBuffer(name);
      await this.db.dropFile(name);
      return bytes;
    });
  }
}
