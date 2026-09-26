'use client';

import { useProjectStore } from '@/store';
import { DashboardView } from './DashboardView';
import { DashboardsIndex } from './DashboardsIndex';

export function DashboardRoute({ id }: { id: string }) {
  const exists = useProjectStore((s) => s.project?.dashboards.some((d) => d.id === id));
  return exists ? <DashboardView dashboardId={id} /> : <DashboardsIndex />;
}
