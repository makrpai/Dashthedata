'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/useT';
import { listProjects, openProject } from '@/lib/workspace/projects';
import type { Project } from '@/types/domain';

/** "Recent projects" on the landing page (17.1). */
export function RecentProjects() {
  const t = useT();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => {
    void listProjects().then(setProjects);
  }, []);
  const time = new Intl.DateTimeFormat(t.locale, { dateStyle: 'medium', timeStyle: 'short' });
  if (!projects?.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[20px] font-bold">{t('project.recent')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.slice(0, 6).map((p) => (
          <Card
            key={p.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer p-4 text-left transition-transform hover:-translate-y-0.5"
            onClick={() => void openProject(p.id).then(() => router.push('/workspace/dashboards'))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') void openProject(p.id).then(() => router.push('/workspace/dashboards'));
            }}
          >
            <p className="truncate font-semibold">{p.name}</p>
            <p className="mt-1 text-[13px] text-fg-2">{t('project.updated', { time: time.format(new Date(p.updatedAt)) })}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
