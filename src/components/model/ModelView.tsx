'use client';

import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/sonner';
import { ViewHeader } from '@/components/views/ViewHeader';
import { useT } from '@/lib/i18n/useT';
import { suggestUnions } from '@/lib/model/union';
import { createJoinDataset, createUnionDataset, refreshRelationships, setRelationshipStatus } from '@/lib/workspace/modelActions';
import { useProjectStore } from '@/store';
import { EMPTY } from '@/lib/util/empty';
import '@xyflow/react/dist/style.css';

export function ModelView() {
  const t = useT();
  const datasets = useProjectStore((s) => s.project?.datasets ?? EMPTY);
  const relationships = useProjectStore((s) => s.project?.relationships ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const suggestions = useMemo(() => suggestUnions(datasets), [datasets]);
  const sources = datasets.filter((d) => d.kind === 'source');

  const nodes: Node[] = sources.map((d, i) => ({
    id: d.id,
    position: { x: (i % 3) * 280, y: Math.floor(i / 3) * 180 },
    data: { label: d.name },
    style: { borderRadius: 12, padding: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)' },
  }));
  const edges: Edge[] = relationships
    .filter((r) => r.status !== 'rejected')
    .map((r) => ({
      id: r.id,
      source: r.from.datasetId,
      target: r.to.datasetId,
      label: r.status === 'accepted' ? t('model.accepted') : `${Math.round(r.score * 100)}%`,
      animated: r.status === 'suggested',
    }));

  if (sources.length < 2) {
    return (
      <>
        <ViewHeader title={t('views.model.title')} />
        <Card>
          <EmptyState text={t('views.model.empty')} />
        </Card>
      </>
    );
  }

  return (
    <>
      <ViewHeader
        title={t('views.model.title')}
        actions={
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const n = await refreshRelationships();
                toast.success(t('model.detected', { count: n }));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('errors.generic'));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('model.detect')}
          </Button>
        }
      />
      <div className="mb-4 h-[420px] overflow-hidden rounded-[var(--radius-card)] border border-line-strong">
        <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} proOptions={{ hideAttribution: true }}>
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-[16px] font-semibold">{t('model.unions')}</h2>
          {suggestions.length === 0 && <p className="text-[13px] text-fg-2">{t('model.noUnions')}</p>}
          {suggestions.map((s) => {
            const names = s.datasetIds.map((id) => datasets.find((d) => d.id === id)?.name).join(' + ');
            return (
              <div key={s.datasetIds.join(':')} className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px]">{names}</span>
                <Button
                  size="sm"
                  variant="soft"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const id = await createUnionDataset(s.datasetIds, names);
                      if (id) toast.success(t('model.unionCreated'));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('model.createUnion')}
                </Button>
              </div>
            );
          })}
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-[16px] font-semibold">{t('model.relationships')}</h2>
          {relationships.filter((r) => r.status !== 'rejected').length === 0 && <p className="text-[13px] text-fg-2">{t('model.noRelationships')}</p>}
          {relationships
            .filter((r) => r.status !== 'rejected')
            .map((r) => {
              const from = datasets.find((d) => d.id === r.from.datasetId);
              const to = datasets.find((d) => d.id === r.to.datasetId);
              const fromCol = from?.columns.find((c) => c.id === r.from.columnId);
              const toCol = to?.columns.find((c) => c.id === r.to.columnId);
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                  <span>
                    {from?.name}.{fromCol?.displayName} → {to?.name}.{toCol?.displayName}
                  </span>
                  {r.status === 'suggested' ? (
                    <span className="flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => setRelationshipStatus(r.id, 'accepted')}>
                        {t('model.accept')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRelationshipStatus(r.id, 'rejected')}>
                        {t('model.reject')}
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="soft"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const id = await createJoinDataset(r.from.datasetId, `${from?.name ?? ''} + ${to?.name ?? ''}`);
                          if (id) toast.success(t('model.joinCreated'));
                          else toast.error(t('model.joinFailed'));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('model.createJoin')}
                    </Button>
                  )}
                </div>
              );
            })}
        </Card>
      </div>
    </>
  );
}
