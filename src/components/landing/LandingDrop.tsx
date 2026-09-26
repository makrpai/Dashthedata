'use client';

import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/useT';

/** Hero drop zone. Wired to the importer in phase 1. */
export function LandingDrop() {
  const t = useT();
  return (
    <div className="nm-inset flex w-full max-w-2xl flex-col items-center gap-4 rounded-[24px] px-6 py-10">
      <Upload className="size-7 text-slate" aria-hidden />
      <p className="text-[16px] font-semibold">{t('sources.drop.title')}</p>
      <p className="text-[14px] text-fg-2">{t('sources.drop.privacy')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="primary" size="lg">
          <Link href="/workspace/data">{t('landing.trySample')}</Link>
        </Button>
        <Button asChild variant="soft" size="lg">
          <Link href="/workspace/data">{t('sources.drop.browse')}</Link>
        </Button>
      </div>
    </div>
  );
}
