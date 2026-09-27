import { assertPublicHost } from '@/lib/connectors/ssrf';
import { assertSelectOnly } from '@/lib/connectors/sqlGuard';
import { Client } from 'pg';

export async function queryPostgres(opts: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  sql: string;
}): Promise<{ headers: string[]; rows: string[][] }> {
  if (process.env.CONNECTORS_ENABLED === 'false') throw new Error('Connectors are disabled');
  await assertPublicHost(opts.host);
  const guarded = assertSelectOnly(opts.sql);
  const sql = /\blimit\b/i.test(guarded) ? guarded : `${guarded} LIMIT 5000`;
  const client = new Client({
    host: opts.host,
    port: opts.port,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    ssl: opts.ssl ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 8000,
    statement_timeout: 8000,
  });
  await client.connect();
  try {
    const result = await client.query(sql);
    const headers = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) => headers.map((h) => (row[h] === null || row[h] === undefined ? '' : String(row[h]))));
    return { headers, rows };
  } finally {
    await client.end();
  }
}
