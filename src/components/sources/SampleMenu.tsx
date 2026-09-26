'use client';

import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/useT';
import { useImportStore } from '@/store/import';
import { SAMPLES, useImport } from './useImport';

/** "Try with sample data" (language-dependent default) + "Other samples" (21). */
export function SampleMenu({ onPick }: { onPick?: (files: string[]) => void }) {
  const t = useT();
  const { importSample } = useImport();
  const busy = useImportStore((s) => s.busy);
  const pick = onPick ?? ((files: string[]) => void importSample(files));
  const primary = t.locale === 'fi' ? SAMPLES[0] : SAMPLES[1];
  return (
    <div className="flex">
      <Button variant="primary" disabled={busy} onClick={() => pick([...primary.files])} className="rounded-r-none">
        {t('sources.sample')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="primary" disabled={busy} className="rounded-l-none border-l border-l-primary-fg/30 px-2.5" aria-label={t('sources.otherSamples')}>
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>{t('sources.otherSamples')}</DropdownMenuLabel>
          {SAMPLES.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => pick([...s.files])} className="flex-col items-start gap-0.5">
              <span className="font-semibold">{s.files.join(' + ')}</span>
              <span className="text-[13px] text-fg-2">{t.dynamic(s.key)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
