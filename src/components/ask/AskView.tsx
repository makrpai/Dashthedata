'use client';

import { useState } from 'react';
import { ConsentDialog } from '@/components/ai/ConsentDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ViewHeader } from '@/components/views/ViewHeader';
import { parseAiJson, summarizeDatasets } from '@/lib/ai/tasks';
import { runAsk } from '@/lib/ai/runAsk';
import { useT } from '@/lib/i18n/useT';
import { addChartToDashboard, ensureDashboard } from '@/lib/workspace/dashboards';
import { useProjectStore } from '@/store';
import type { ChartSpec, ChartType } from '@/types/domain';
import { newId } from '@/lib/util/id';

const CHART_TYPES = new Set<ChartType>(['bar', 'line', 'kpi', 'hbar', 'area', 'table']);

export function AskView() {
  const t = useT();
  const project = useProjectStore((s) => s.project);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const ask = async () => {
    if (!project) return;
    if (!project.settings.ai.consentGiven) {
      setConsentOpen(true);
      return;
    }
    setBusy(true);
    try {
      const summary = summarizeDatasets(project.datasets, project.settings.ai.includeCategoryValues);
      const raw = await runAsk(summary, question);
      const parsed = parseAiJson(raw);
      setAnswer(parsed.text);
      if (parsed.chart) {
        const dataset = project.datasets.find((d) => d.name === parsed.chart?.dataset);
        const x = dataset?.columns.find((c) => c.displayName === parsed.chart?.x);
        const y = dataset?.columns.find((c) => c.displayName === parsed.chart?.y);
        const type = CHART_TYPES.has(parsed.chart.type as ChartType) ? (parsed.chart.type as ChartType) : 'bar';
        if (dataset && (type === 'kpi' || x) && y) {
          const spec: ChartSpec = {
            id: newId('ch'),
            datasetId: dataset.id,
            type,
            x: x ? { columnId: x.id } : undefined,
            y: [{ columnId: y.id, agg: 'sum' }],
            origin: 'ai',
            aiProvider: 'claude',
            aiReason: parsed.text,
          };
          const dashboardId = ensureDashboard(t('views.dashboards.title'));
          if (dashboardId) addChartToDashboard(dashboardId, spec);
        }
      }
    } catch (err) {
      setAnswer(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ViewHeader title={t('views.ask.title')} />
      <Card className="flex flex-col gap-3 p-4">
        <Textarea aria-label={t('views.ask.title')} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('topbar.askPlaceholder')} />
        <Button variant="primary" disabled={busy || !question.trim() || !project} onClick={() => void ask()}>
          {t('askPanel.send')}
        </Button>
        {answer && (
          <section aria-label={t('askPanel.answer')}>
            <h2 className="mb-1 text-[14px] font-semibold">{t('askPanel.answer')}</h2>
            <p className="text-[14px] text-fg-2">{answer}</p>
          </section>
        )}
      </Card>
      <ConsentDialog open={consentOpen} onClose={() => setConsentOpen(false)} />
    </>
  );
}
