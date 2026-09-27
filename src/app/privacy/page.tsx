'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/useT';

export default function PrivacyPage() {
  const t = useT();
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-[39px] font-bold">{t('privacyPage.title')}</h1>
      <p className="text-[16px] leading-relaxed text-fg-2">{t('privacyPage.body')}</p>
      <Button asChild variant="soft" className="self-start">
        <Link href="/">{t('common.back')}</Link>
      </Button>
    </main>
  );
}
