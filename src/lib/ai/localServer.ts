'use client';

/** OpenAI-compatible or Ollama chat on a user-configured local server. */
export async function askLocalServer(baseUrl: string, kind: 'auto' | 'ollama' | 'openai', model: string | undefined, prompt: string): Promise<string> {
  const root = baseUrl.replace(/\/$/, '');
  const useOllama = kind === 'ollama' || (kind === 'auto' && root.includes('11434'));
  if (useOllama) {
    const res = await fetch(`${root}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: model || 'llama3.2', messages: [{ role: 'user', content: prompt }], stream: false }),
    });
    if (!res.ok) throw new Error(`Local model HTTP ${res.status}`);
    const body = (await res.json()) as { message?: { content?: string } };
    return body.message?.content ?? '';
  }
  const res = await fetch(`${root}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: model || 'local', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Local model HTTP ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? '';
}
