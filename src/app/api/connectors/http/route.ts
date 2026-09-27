import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeHttpSource, rowsFromJson } from '@/lib/connectors/http';
import { assertPublicUrl } from '@/lib/connectors/ssrf';

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

export async function POST(request: Request) {
  if (process.env.CONNECTORS_ENABLED === 'false') return NextResponse.json({ error: 'Connectors are disabled' }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  try {
    const normalized = normalizeHttpSource(parsed.data.url);
    const url = await assertPublicUrl(normalized.url);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    if (res.status >= 300 && res.status < 400) return NextResponse.json({ error: 'Redirects are not followed' }, { status: 400 });
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 400 });
    const text = await res.text();
    if (normalized.googleSheets || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
      return NextResponse.json({ format: 'csv', text: text.slice(0, 5_000_000), googleSheets: normalized.googleSheets });
    }
    const table = rowsFromJson(JSON.parse(text));
    return NextResponse.json({ format: 'json', ...table, googleSheets: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Request failed' }, { status: 400 });
  }
}
