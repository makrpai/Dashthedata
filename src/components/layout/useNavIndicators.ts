'use client';

import { useT } from '@/lib/i18n/useT';
import { useProjectStore } from '@/store';
import type { NavId } from './nav';

export interface NavIndicator {
  count?: number;
  countLabel?: string;
  dot?: 'accent' | 'success' | 'danger' | null;
  dotLabel?: string;
}

/** Counters and status dots for sidebar items: sources, pending suggestions, connection state. */
export function useNavIndicators(): Partial<Record<NavId, NavIndicator>> {
  const t = useT();
  const project = useProjectStore((s) => s.project);
  const connectionState = useProjectStore((s) => s.connectionState);
  if (!project) return {};
  const sourceCount = project.sources.length;
  const pending = project.datasets.some((d) => d.pipeline.some((step) => step.suggested));
  return {
    data: { count: sourceCount, countLabel: t('nav.sourceCount', { count: sourceCount }) },
    transform: pending ? { dot: 'accent', dotLabel: t('nav.pendingSuggestions') } : undefined,
    integrations:
      connectionState === 'none'
        ? undefined
        : {
            dot: connectionState === 'error' ? 'danger' : 'success',
            dotLabel: t('nav.connectionStatus'),
          },
  };
}
