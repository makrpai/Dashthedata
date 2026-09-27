import type { Dataset } from '@/types/domain';

export interface AiColumnSummary {
  name: string;
  type: string;
  role: string;
  examples?: string[];
}

export interface AiDatasetSummary {
  name: string;
  columns: AiColumnSummary[];
}

export function summarizeDatasets(datasets: Dataset[], includeValues: boolean): AiDatasetSummary[] {
  return datasets
    .filter((d) => !d.hidden && d.columns.length)
    .slice(0, 8)
    .map((d) => ({
      name: d.name,
      columns: d.columns.slice(0, 40).map((c) => ({
        name: c.displayName,
        type: c.type,
        role: c.role,
        ...(includeValues && c.stats.top ? { examples: c.stats.top.slice(0, 5).map((v) => v.value) } : {}),
      })),
    }));
}

export function askPrompt(summary: AiDatasetSummary[], question: string): string {
  return [
    'You are Dash the Data, a local-first BI assistant. Answer in the same language as the question.',
    'Use only the schema below. Do not invent columns.',
    'Reply with JSON only: {"text":"short answer","chart":null} or {"text":"...","chart":{"dataset":"name","type":"bar|line|kpi","x":"column","y":"column"}}.',
    `Schema: ${JSON.stringify(summary)}`,
    `Question: ${question}`,
  ].join('\n');
}

export function parseAiJson(text: string): { text: string; chart?: { dataset: string; type: string; x?: string; y?: string } } {
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) return { text };
  try {
    const parsed = JSON.parse(fenced[0]) as { text?: string; chart?: { dataset?: string; type?: string; x?: string; y?: string } | null };
    return {
      text: parsed.text ?? text,
      chart: parsed.chart?.dataset && parsed.chart.type ? { dataset: parsed.chart.dataset, type: parsed.chart.type, x: parsed.chart.x, y: parsed.chart.y } : undefined,
    };
  } catch {
    return { text };
  }
}
