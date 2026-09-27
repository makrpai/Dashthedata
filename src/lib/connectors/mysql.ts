import mysql from 'mysql2/promise';
import { assertPublicHost } from '@/lib/connectors/ssrf';
import { assertSelectOnly } from '@/lib/connectors/sqlGuard';

export async function queryMysql(opts: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sql: string;
}): Promise<{ headers: string[]; rows: string[][] }> {
  if (process.env.CONNECTORS_ENABLED === 'false') throw new Error('Connectors are disabled');
  await assertPublicHost(opts.host);
  const guarded = assertSelectOnly(opts.sql);
  const sql = /\blimit\b/i.test(guarded) ? guarded : `${guarded} LIMIT 5000`;
  const conn = await mysql.createConnection({
    host: opts.host,
    port: opts.port,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    connectTimeout: 8000,
  });
  try {
    const [rows, fields] = await conn.query(sql);
    const list = Array.isArray(rows) ? rows : [];
    const headers = (fields ?? []).map((f) => f.name);
    return {
      headers,
      rows: list.map((row) => headers.map((h) => {
        const cell = (row as Record<string, unknown>)[h];
        return cell === null || cell === undefined ? '' : String(cell);
      })),
    };
  } finally {
    await conn.end();
  }
}
