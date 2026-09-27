'use client';

import { CircleAlert, Loader2 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useImport } from '@/components/sources/useImport';
import { useT } from '@/lib/i18n/useT';
import { useProjectStore } from '@/store';

/** Shown when a saved/imported project has sources without loaded data. */
export function MissingDataBanner() {
  const t = useT();
  const missing = useProjectStore((s) => s.missingSources.length);
  const restoring = useProjectStore((s) => s.restoring);
  const { importFiles } = useImport();
  const input = useRef<HTMLInputElement>(null);
  if (restoring) {
    return (
      <p className="mx-4 mb-2 flex items-center gap-2 text-[13px] text-fg-2 md:mx-6" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('project.restoring')}
      </p>
    );
  }
  if (!missing) return null;
  return (
    <div role="status" className="nm-flat mx-4 mb-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] px-4 py-2.5 md:mx-6">
      <CircleAlert className="size-4 text-danger" aria-hidden />
      <p className="min-w-0 flex-1 text-[13px]">
        <span className="font-semibold">{t('project.missingData', { count: missing })}</span> {t('project.missingHint')}
      </p>
      <Button size="sm" variant="soft" onClick={() => input.current?.click()}>
        {t('project.reconnect')}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void importFiles(files);
        }}
      />
    </div>
  );
}
