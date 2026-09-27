import { NextResponse } from 'next/server';
import { z } from 'zod';
import { completeWithClaude } from '@/lib/ai/anthropic';
import { allowAiRequest } from '@/lib/ai/ratelimit';
import { askPrompt, type AiDatasetSummary } from '@/lib/ai/tasks';

const bodySchema = z.object({
  question: z.string().min(1).max(2000),
  summary: z
    .array(
      z.object({
        name: z.string(),
        columns: z.array(z.object({ name: z.string(), type: z.string(), role: z.string(), examples: z.array(z.string()).max(5).optional() })).max(40),
      }),
    )
    .max(8),
});

export async function POST(request: Request) {
  if (process.env.AI_ENABLED === 'false') return NextResponse.json({ error: 'AI is disabled' }, { status: 403 });
  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!(await allowAiRequest(key))) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const apiKey = request.headers.get('x-api-key') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 503 });
  try {
    const text = await completeWithClaude(askPrompt(parsed.data.summary as AiDatasetSummary[], parsed.data.question), apiKey);
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI request failed' }, { status: 502 });
  }
}
