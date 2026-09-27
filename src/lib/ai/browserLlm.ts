'use client';

/** Runs a small model in the browser with WebLLM. The model files come from the hosts allowed by CSP. */
export async function askBrowserModel(modelId: string, prompt: string): Promise<string> {
  const webllm = (await import('@mlc-ai/web-llm')) as unknown as {
    CreateMLCEngine: (model: string) => Promise<{
      chat: { completions: { create: (req: { messages: Array<{ role: 'user'; content: string }> }) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }> } };
    }>;
  };
  const engine = await webllm.CreateMLCEngine(modelId);
  const reply = await engine.chat.completions.create({ messages: [{ role: 'user', content: prompt }] });
  return reply.choices[0]?.message?.content ?? '';
}
