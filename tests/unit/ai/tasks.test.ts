import { describe, expect, it } from 'vitest';
import { parseAiJson } from '@/lib/ai/tasks';
import { hitMemoryLimit } from '@/lib/ai/ratelimit';

describe('ai tasks', () => {
  it('parses a fenced chart answer', () => {
    const parsed = parseAiJson('```json\n{"text":"Sales rose","chart":{"dataset":"orders","type":"line","x":"pvm","y":"summa"}}\n```');
    expect(parsed.text).toBe('Sales rose');
    expect(parsed.chart?.type).toBe('line');
  });

  it('limits repeated calls in memory', () => {
    const key = `k-${Date.now()}`;
    expect(hitMemoryLimit(key, 2, 1000)).toBe(true);
    expect(hitMemoryLimit(key, 2, 1000)).toBe(true);
    expect(hitMemoryLimit(key, 2, 1000)).toBe(false);
  });
});
