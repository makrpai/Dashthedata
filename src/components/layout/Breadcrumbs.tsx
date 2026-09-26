'use client';

import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';
import { useProjectStore } from '@/store';
import { useUiStore } from '@/store/ui';
import { activeNavItem } from './nav';

/** "Project / View / Item" (17.1). The item part is set by the active view. */
export function Breadcrumbs() {
  const t = useT();
  const pathname = usePathname();
  const item = activeNavItem(pathname);
  const projectName = useProjectStore((s) => s.project?.name);
  const extra = useUiStore((s) => s.breadcrumbExtra);
  const parts = [projectName ?? t('project.untitled'), item ? t(item.label) : null, extra].filter(
    (p): p is string => Boolean(p),
  );
  return (
    <nav aria-label={t('topbar.breadcrumb')} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[14px]">
        {parts.map((part, i) => (
          <li key={`${i}-${part}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate" aria-hidden />}
            <span
              className={i === parts.length - 1 ? 'truncate font-semibold text-fg' : 'truncate text-fg-2'}
              aria-current={i === parts.length - 1 ? 'page' : undefined}
            >
              {part}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
