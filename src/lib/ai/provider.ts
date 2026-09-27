'use client';

import { askBrowserModel } from '@/lib/ai/browserLlm';
import { askLocalServer } from '@/lib/ai/localServer';
import { readOwnKey } from '@/lib/ai/prefs';
import { askPrompt, type AiDatasetSummary } from '@/lib/ai/tasks';
import type { AiPreferences } from '@/types/domain';

export interface LlmProvider {
  readonly id: AiPreferences['provider'];
  ask(summary: AiDatasetSummary[], question: string): Promise<string>;
}

function assertLocalEnabled(): void {
  if (process.env.NEXT_PUBLIC_LOCAL_AI_ENABLED === 'false') throw new Error('Local AI is disabled');
}

export function providerFor(prefs: AiPreferences): LlmProvider {
  if (prefs.provider === 'browser') {
    return {
      id: 'browser',
      ask(summary, question) {
        assertLocalEnabled();
        return askBrowserModel(prefs.browser.modelId || 'Llama-3.2-1B-Instruct-q4f32_1-MLC', askPrompt(summary, question));
      },
    };
  }
  if (prefs.provider === 'local-server') {
    return {
      id: 'local-server',
      ask(summary, question) {
        assertLocalEnabled();
        return askLocalServer(prefs.localServer.baseUrl, prefs.localServer.kind, prefs.localServer.model, askPrompt(summary, question));
      },
    };
  }
  return {
    id: 'claude',
    async ask(summary, question) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const own = readOwnKey();
      if (prefs.claude.useOwnKey && own) headers['x-api-key'] = own;
      const res = await fetch('/api/ai/ask', { method: 'POST', headers, body: JSON.stringify({ question, summary }) });
      const body = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? 'AI request failed');
      return body?.text ?? '';
    },
  };
}
