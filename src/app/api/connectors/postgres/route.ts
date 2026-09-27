import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryPostgres } from '@/lib/connectors/postgres';

const bodySchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().default(true),
  sql: z.string().min(1).max(8000),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid connection' }, { status: 400 });
  try {
    const table = await queryPostgres(parsed.data);
    return NextResponse.json(table);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Query failed' }, { status: 400 });
  }
}
