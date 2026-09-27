'use client';

import { providerFor } from '@/lib/ai/provider';
import { readAiPrefs } from '@/lib/ai/prefs';
import type { AiDatasetSummary } from '@/lib/ai/tasks';

export async function runAsk(summary: AiDatasetSummary[], question: string): Promise<string> {
  return providerFor(readAiPrefs()).ask(summary, question);
}
