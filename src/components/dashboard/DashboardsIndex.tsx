'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ViewHeader } from '@/components/views/ViewHeader';
import { useT } from '@/lib/i18n/useT';
import { ensureDashboard } from '@/lib/workspace/dashboards';
import { useProjectStore } from '@/store';

/** /workspace/dashboards: opens the first dashboard (creating one when data exists). */
export function DashboardsIndex() {
  const t = useT();
  const router = useRouter();
  const hasData = useProjectStore((s) => (s.project?.datasets.length ?? 0) > 0);
  const firstId = useProjectStore((s) => s.project?.dashboards[0]?.id);
  useEffect(() => {
    const id = firstId ?? (hasData ? ensureDashboard(t('views.dashboards.title')) : null);
    if (id) router.replace(`/workspace/dashboards/${id}`);
  }, [firstId, hasData, router, t]);
  if (hasData) return null;
  return (
    <>
      <ViewHeader title={t('views.dashboards.title')} />
      <Card>
        <EmptyState
          text={t('views.dashboards.noProject')}
          action={
            <Button asChild variant="primary">
              <Link href="/workspace/data">{t('views.goToData')}</Link>
            </Button>
          }
        />
      </Card>
    </>
  );
}
