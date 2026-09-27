import Anthropic from '@anthropic-ai/sdk';

export async function completeWithClaude(prompt: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content.find((part) => part.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}
